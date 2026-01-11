const express = require('express');
const router = express.Router();

// Store MFA status for real-time updates
const mfaStatus = new Map();

// Set MFA status
function setMFAStatus(userId, status, data = {}) {
  mfaStatus.set(userId, {
    status,
    timestamp: Date.now(),
    ...data
  });
}

// Get MFA status endpoint
router.get('/status/:userId', (req, res) => {
  const { userId } = req.params;
  const status = mfaStatus.get(userId) || { status: 'none' };
  res.json(status);
});

// Clear MFA status
router.delete('/status/:userId', (req, res) => {
  const { userId } = req.params;
  mfaStatus.delete(userId);
  res.json({ success: true });
});

// Server-Sent Events for real-time MFA updates
router.get('/stream/:userId', (req, res) => {
  const { userId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Send initial status
  const initialStatus = mfaStatus.get(userId) || { status: 'waiting' };
  res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);
  
  // Check for updates every 2 seconds
  const interval = setInterval(() => {
    const currentStatus = mfaStatus.get(userId);
    if (currentStatus) {
      res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
      
      // Close connection if completed or failed
      if (currentStatus.status === 'completed' || currentStatus.status === 'failed') {
        clearInterval(interval);
        res.end();
      }
    }
  }, 2000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = { router, setMFAStatus };