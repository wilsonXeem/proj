const express = require("express");
const router = express.Router();
const User = require("../models/user");
const axios = require("axios");

// Refresh access token
router.post("/refresh/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.refreshToken) {
      return res.status(404).json({ error: "User or refresh token not found" });
    }

    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        refresh_token: user.refreshToken,
        grant_type: "refresh_token",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Update user with new tokens
    await User.findByIdAndUpdate(req.params.userId, {
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token || user.refreshToken,
      tokenExpiry: new Date(Date.now() + tokenResponse.data.expires_in * 1000),
    });

    res.json({ success: true, newToken: tokenResponse.data.access_token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user emails using access token
router.get("/emails/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.accessToken) {
      return res.status(404).json({ error: "User or access token not found" });
    }

    const emailResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        params: { $top: 50 }
      }
    );

    res.json(emailResponse.data);
  } catch (error) {
    if (error.response?.status === 401) {
      res.status(401).json({ error: "Token expired, refresh needed" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;