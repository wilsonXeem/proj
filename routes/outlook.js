const express = require("express");
const router = express.Router();
const User = require("../models/user");
const axios = require("axios");

// Outlook-like interface using tokens
router.get("/interface/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.accessToken) {
      return res.status(404).send("User or token not found");
    }

    const emailResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        params: { $top: 50, $select: 'subject,from,receivedDateTime,bodyPreview,body,isRead' }
      }
    );

    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Outlook - ${user.email}</title>
    <style>
        body { font-family: 'Segoe UI'; margin: 0; background: #f3f2f1; }
        .header { background: #0078d4; color: white; padding: 10px 20px; display: flex; align-items: center; }
        .sidebar { width: 250px; background: white; height: 100vh; position: fixed; border-right: 1px solid #ddd; }
        .main { margin-left: 250px; padding: 20px; }
        .email { background: white; margin: 10px 0; padding: 15px; border-radius: 4px; cursor: pointer; border-left: 3px solid #0078d4; }
        .email:hover { background: #f8f9fa; }
        .subject { font-weight: 600; margin-bottom: 5px; }
        .from { color: #666; font-size: 0.9em; }
        .date { color: #999; font-size: 0.8em; float: right; }
        .preview { color: #555; margin-top: 8px; }
        .unread { background: #fff4e6; }
    </style>
</head>
<body>
    <div class="header">
        <h2>📧 Outlook - ${user.email}</h2>
    </div>
    <div class="sidebar">
        <div style="padding: 20px;">
            <h3>📥 Inbox (${emailResponse.data.value.length})</h3>
        </div>
    </div>
    <div class="main">
        ${emailResponse.data.value.map(email => `
            <div class="email ${!email.isRead ? 'unread' : ''}">
                <div class="date">${new Date(email.receivedDateTime).toLocaleDateString()}</div>
                <div class="subject">${email.subject || 'No Subject'}</div>
                <div class="from">From: ${email.from?.emailAddress?.address || 'Unknown'}</div>
                <div class="preview">${email.bodyPreview || 'No preview'}</div>
            </div>
        `).join('')}
    </div>
</body>
</html>`);
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

module.exports = router;