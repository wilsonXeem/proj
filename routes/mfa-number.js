const express = require('express');
const router = express.Router();

// Store current MFA numbers
const mfaNumbers = new Map();

// Get current MFA number for user
router.get('/number/:userId', (req, res) => {
  const { userId } = req.params;
  const mfaData = mfaNumbers.get(userId);
  
  if (mfaData) {
    res.json({
      hasNumber: true,
      number: mfaData.number,
      timestamp: mfaData.timestamp
    });
  } else {
    res.json({ hasNumber: false });
  }
});

// Set MFA number (called by Playwright)
router.post('/set-number', (req, res) => {
  const { userId, number } = req.body;
  
  if (userId && number) {
    mfaNumbers.set(userId, {
      number,
      timestamp: Date.now()
    });
    
    console.log(`🔢 MFA Number stored for user ${userId}: ${number}`);
  }
  
  res.json({ success: true });
});

// Clear MFA number
router.delete('/number/:userId', (req, res) => {
  const { userId } = req.params;
  mfaNumbers.delete(userId);
  res.json({ success: true });
});

module.exports = router;