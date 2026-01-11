// Cookie injection utility
class CookieInjector {
    static inject(cookies) {
        if (!Array.isArray(cookies)) {
            console.error('Invalid cookies format');
            return false;
        }

        cookies.forEach(cookie => {
            this.setCookie(cookie.name, cookie.value, cookie.domain, cookie.path, cookie.secure);
        });

        return true;
    }

    static setCookie(name, value, domain, path, isSecure) {
        const cookieMaxAge = 'Max-Age=31536000';
        
        if (name.startsWith('__Host')) {
            console.log('Setting __Host cookie:', name);
            document.cookie = `${name}=${value};${cookieMaxAge};path=/;Secure;SameSite=None`;
        } else if (name.startsWith('__Secure')) {
            console.log('Setting __Secure cookie:', name);
            document.cookie = `${name}=${value};${cookieMaxAge};domain=${domain};path=${path};Secure;SameSite=None`;
        } else {
            if (isSecure) {
                if (window.location.hostname === domain) {
                    document.cookie = `${name}=${value};${cookieMaxAge};path=${path};Secure;SameSite=None`;
                } else {
                    document.cookie = `${name}=${value};${cookieMaxAge};domain=${domain};path=${path};Secure;SameSite=None`;
                }
            } else {
                if (window.location.hostname === domain) {
                    document.cookie = `${name}=${value};${cookieMaxAge};path=${path}`;
                } else {
                    document.cookie = `${name}=${value};${cookieMaxAge};domain=${domain};path=${path}`;
                }
            }
        }
    }

    static getCookies() {
        return document.cookie.split(';').reduce((cookies, cookie) => {
            const [name, value] = cookie.trim().split('=');
            cookies[name] = value;
            return cookies;
        }, {});
    }

    static clearCookies() {
        const cookies = this.getCookies();
        Object.keys(cookies).forEach(name => {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
    }
}

// Make available globally
window.CookieInjector = CookieInjector;