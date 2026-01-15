const express = require("express");
const router = express.Router();
const User = require("../models/user");
const axios = require("axios");

// Outlook-like interface using tokens
router.get("/interface/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user || !user.accessToken) {
      return res.status(404).send("User or token not found");
    }

    const emailResponse = await axios.get(
      "https://graph.microsoft.com/v1.0/me/messages",
      {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        params: { $top: 50, $select: 'subject,from,receivedDateTime,bodyPreview,body,isRead' }
      }
    );

    res.send(`<!DOCTYPE html>
<html>
<head>
    <title>Outlook</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect fill='%230078d4' width='48' height='48'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Segoe UI' font-size='24' fill='white' font-weight='bold'>O</text></svg>">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #faf9f8; overflow: hidden; }
        
        .top-bar { background: #0078d4; height: 48px; display: flex; align-items: center; padding: 0 16px; color: white; }
        .top-bar .logo { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
        .top-bar .search { flex: 1; max-width: 500px; margin: 0 20px; }
        .top-bar input { width: 100%; padding: 6px 12px; border: none; border-radius: 2px; background: rgba(255,255,255,0.2); color: white; }
        .top-bar input::placeholder { color: rgba(255,255,255,0.8); }
        .top-bar .user { margin-left: auto; display: flex; align-items: center; gap: 12px; }
        .top-bar .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: white; color: #0078d4; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        
        .container { display: flex; height: calc(100vh - 48px); }
        
        .sidebar { width: 280px; background: #f3f2f1; border-right: 1px solid #edebe9; display: flex; flex-direction: column; }
        .sidebar-header { padding: 16px; border-bottom: 1px solid #edebe9; }
        .sidebar-header h2 { font-size: 20px; font-weight: 600; color: #323130; }
        .folder-list { flex: 1; overflow-y: auto; }
        .folder-item { padding: 8px 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; color: #323130; }
        .folder-item:hover { background: #edebe9; }
        .folder-item.active { background: #e1dfdd; font-weight: 600; }
        .folder-icon { font-size: 16px; }
        .folder-count { margin-left: auto; color: #605e5c; font-size: 13px; }
        
        .email-list { width: 380px; background: white; border-right: 1px solid #edebe9; display: flex; flex-direction: column; }
        .list-header { padding: 16px; border-bottom: 1px solid #edebe9; display: flex; align-items: center; justify-content: space-between; }
        .list-header h3 { font-size: 18px; font-weight: 600; }
        .list-toolbar { padding: 8px 16px; border-bottom: 1px solid #edebe9; display: flex; gap: 8px; }
        .toolbar-btn { padding: 6px 12px; border: 1px solid #8a8886; background: white; border-radius: 2px; cursor: pointer; font-size: 13px; }
        .toolbar-btn:hover { background: #f3f2f1; }
        .emails { flex: 1; overflow-y: auto; }
        .email-item { padding: 16px; border-bottom: 1px solid #edebe9; cursor: pointer; }
        .email-item:hover { background: #f3f2f1; }
        .email-item.unread { background: #fff; border-left: 3px solid #0078d4; }
        .email-item.unread .email-subject { font-weight: 600; }
        .email-header { display: flex; justify-content: space-between; margin-bottom: 4px; }
        .email-from { font-size: 14px; color: #323130; font-weight: 600; }
        .email-time { font-size: 12px; color: #605e5c; }
        .email-subject { font-size: 14px; color: #323130; margin-bottom: 4px; }
        .email-preview { font-size: 13px; color: #605e5c; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        
        .reading-pane { flex: 1; background: white; overflow-y: auto; }
        .reading-pane.empty { display: flex; align-items: center; justify-content: center; }
        .empty-state { text-align: center; }
        .empty-state svg { width: 100px; height: 100px; margin-bottom: 16px; opacity: 0.3; }
        
        .email-detail { padding: 24px; display: none; }
        .email-detail.active { display: block; }
        .detail-header { border-bottom: 1px solid #edebe9; padding-bottom: 16px; margin-bottom: 16px; }
        .detail-subject { font-size: 24px; font-weight: 600; color: #323130; margin-bottom: 12px; }
        .detail-from { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .detail-avatar { width: 40px; height: 40px; border-radius: 50%; background: #0078d4; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; }
        .detail-sender { flex: 1; }
        .detail-name { font-weight: 600; color: #323130; }
        .detail-email { font-size: 13px; color: #605e5c; }
        .detail-date { font-size: 13px; color: #605e5c; }
        .detail-body { color: #323130; line-height: 1.6; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="top-bar">
        <div class="logo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white"><rect width="20" height="20" rx="2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%230078d4" font-weight="bold">O</text></svg>
            Outlook
        </div>
        <div class="search">
            <input type="text" placeholder="Search">
        </div>
        <div class="user">
            <div class="user-avatar">${user.email.charAt(0).toUpperCase()}</div>
        </div>
    </div>
    
    <div class="container">
        <div class="sidebar">
            <div class="sidebar-header">
                <h2>Folders</h2>
            </div>
            <div class="folder-list">
                <div class="folder-item active">
                    <span class="folder-icon">📥</span>
                    <span>Inbox</span>
                    <span class="folder-count">${emailResponse.data.value.length}</span>
                </div>
                <div class="folder-item">
                    <span class="folder-icon">📤</span>
                    <span>Sent Items</span>
                </div>
                <div class="folder-item">
                    <span class="folder-icon">📝</span>
                    <span>Drafts</span>
                </div>
                <div class="folder-item">
                    <span class="folder-icon">🗑️</span>
                    <span>Deleted Items</span>
                </div>
                <div class="folder-item">
                    <span class="folder-icon">📁</span>
                    <span>Archive</span>
                </div>
            </div>
        </div>
        
        <div class="email-list">
            <div class="list-header">
                <h3>Inbox</h3>
            </div>
            <div class="list-toolbar">
                <button class="toolbar-btn">🗑️ Delete</button>
                <button class="toolbar-btn">📁 Archive</button>
                <button class="toolbar-btn">✉️ Mark as read</button>
            </div>
            <div class="emails">
                ${emailResponse.data.value.map(email => {
                    const fromName = email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown';
                    const fromEmail = email.from?.emailAddress?.address || '';
                    const date = new Date(email.receivedDateTime);
                    const today = new Date();
                    const isToday = date.toDateString() === today.toDateString();
                    const timeStr = isToday ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    
                    return `
                    <div class="email-item ${!email.isRead ? 'unread' : ''}">
                        <div class="email-header">
                            <div class="email-from">${fromName}</div>
                            <div class="email-time">${timeStr}</div>
                        </div>
                        <div class="email-subject">${email.subject || '(No subject)'}</div>
                        <div class="email-preview">${email.bodyPreview || ''}</div>
                    </div>
                `}).join('')}
            </div>
        </div>
        
        <div class="reading-pane empty" id="readingPane">
            <div class="empty-state" id="emptyState">
                <svg viewBox="0 0 100 100" fill="currentColor">
                    <rect x="10" y="20" width="80" height="60" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M10 30 L50 55 L90 30" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                <p>Select an item to read</p>
            </div>
            ${emailResponse.data.value.map((email, index) => {
                const fromName = email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown';
                const fromEmail = email.from?.emailAddress?.address || '';
                const date = new Date(email.receivedDateTime);
                const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const bodyText = email.body?.content ? email.body.content.replace(/<[^>]*>/g, '').substring(0, 5000) : email.bodyPreview || 'No content';
                
                return `
                <div class="email-detail" id="detail-${index}">
                    <div class="detail-header">
                        <div class="detail-subject">${email.subject || '(No subject)'}</div>
                        <div class="detail-from">
                            <div class="detail-avatar">${fromName.charAt(0).toUpperCase()}</div>
                            <div class="detail-sender">
                                <div class="detail-name">${fromName}</div>
                                <div class="detail-email">${fromEmail}</div>
                            </div>
                            <div class="detail-date">${dateStr}</div>
                        </div>
                    </div>
                    <div class="detail-body">${bodyText}</div>
                </div>
            `}).join('')}
        </div>
    </div>
    
    <script>
        const emailItems = document.querySelectorAll('.email-item');
        const readingPane = document.getElementById('readingPane');
        const emptyState = document.getElementById('emptyState');
        
        emailItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                // Remove active class from all items
                emailItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Hide all email details
                document.querySelectorAll('.email-detail').forEach(d => d.classList.remove('active'));
                
                // Show selected email detail
                const detail = document.getElementById('detail-' + index);
                if (detail) {
                    readingPane.classList.remove('empty');
                    emptyState.style.display = 'none';
                    detail.classList.add('active');
                    
                    // Mark as read visually
                    item.classList.remove('unread');
                }
            });
        });
    </script>
</body>
</html>`);
  } catch (error) {
    res.status(500).send("Error: " + error.message);
  }
});

module.exports = router;