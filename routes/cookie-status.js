const express = require('express');
const User = require('../models/user');

const router = express.Router();

// Check if user has valid cookies
router.get('/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.json({ hasAuth: false, message: 'User not found' });
    }
    
    const hasValidCookies = user.sessionCookies && 
                           user.sessionCookies.length > 0 &&
                           user.cookieStatus === 'session_captured';
    
    res.json({
      hasAuth: hasValidCookies,
      cookieCount: user.sessionCookies ? user.sessionCookies.length : 0,
      status: user.cookieStatus || 'none',
      lastLogin: user.lastLogin
    });
    
  } catch (error) {
    res.status(500).json({ hasAuth: false, error: error.message });
  }
});

// Manual cookie capture trigger (fallback)
router.post('/capture/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { captureOutlookCookiesPlaywright } = require('./playwright-capture');
    
    console.log(`🔄 Manual cookie capture triggered for user ${userId}`);
    const cookies = await captureOutlookCookiesPlaywright(userId);
    
    res.json({ 
      success: cookies.length > 0,
      cookieCount: cookies.length,
      message: cookies.length > 0 ? 'Cookies captured successfully' : 'No cookies captured'
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;