# Google Drive Sync Setup Guide

This guide walks you through setting up Google Drive sync for Word Master Challenge.

## Prerequisites

- A Google Account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Quick Note for Google Workspace Users

If you have Google Workspace:

- ✅ Use **Internal** user type in Step 3 (simpler setup)
- ✅ Skip the Scopes and Test Users sections
- ✅ No app verification needed
- ✅ Works for all users in your organization

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Word Master Challenge" (or whatever you prefer)
4. Click "Create"

## Step 2: Enable Google Drive API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select user type:
   - **Internal** if you have Google Workspace (recommended - no verification needed)
   - **External** if using a regular Google account
3. Click "Create"
4. Fill in the required fields:
   - **App name**: Word Master Challenge
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click "Save and Continue"

### Configure Scopes (External users only)

**Note**: If you selected "Internal" user type, you may not see a Scopes page - that's okay! Skip to step 6.

If you see a **Scopes** page:

1. Click "Add or Remove Scopes"
2. In the filter box, type "drive.appdata"
3. Check the box for `.../auth/drive.appdata`
   - Description: "View and manage its own configuration data in your Google Drive"
4. Click "Update"
5. Click "Save and Continue"

### Test Users (External users only)

6. If you see a **Test users** page:

   - Click "Add Users"
   - Add your email address (and any other emails that will test the app)
   - Click "Save and Continue"

7. Review the summary page and click "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click "Create Credentials" → "OAuth client ID"
3. Choose **Web application**
4. Name it "Word Master Challenge Web"
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (your production domain)
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (your production domain)
7. Click "Create"
8. **Copy the Client ID** - you'll need this!

## Step 5: Update Your Code

1. Open [src/services/googleDriveSync.js](../src/services/googleDriveSync.js)
2. Find this line:
   ```javascript
   const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
   ```
3. Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID

Example:

```javascript
const CLIENT_ID = "123456789-abcdefghijk.apps.googleusercontent.com";
```

## Step 6: Test It Out

1. Run your app: `npm run dev`
2. Navigate to Parent/Teacher interface
3. Click "Connect Google Drive"
4. You should see a Google sign-in popup
5. Grant permissions
6. Your data should sync!

## How It Works

### Data Storage

- Word Master Challenge stores all data (children, words, progress) in a single JSON file
- The file is stored in Google Drive's **App Data folder**
- This folder is hidden from users and specific to your app
- Users can't accidentally delete or modify the file

### Sync Process

1. **First connection**: Uploads your current local data to Drive
2. **On other devices**: Downloads and merges cloud data with local data
3. **Conflict resolution**: Most recent timestamp wins

### Privacy & Security

- **No server needed**: Everything is client-side
- **User owns their data**: Stored in their own Google Drive
- **App-specific folder**: Hidden from user, can't interfere with other files
- **Revokable access**: Users can revoke access anytime in Google account settings

## Troubleshooting

### "Cloud sync unavailable" message

- Check that Google API scripts are loaded in [index.html](../index.html)
- Check browser console for errors
- Make sure you've enabled the Drive API in Google Cloud Console

### "Failed to connect" error

- Verify your Client ID is correct in `googleDriveSync.js`
- Check that your domain is listed in "Authorized JavaScript origins"
- Make sure you added the `.../auth/drive.appdata` scope

### OAuth consent screen shows "App not verified"

- This is normal for **External** apps in testing mode
- Click "Advanced" → "Go to Word Master Challenge (unsafe)"
- **Google Workspace users**: If you used "Internal" type, you won't see this warning
- For production with External apps, you'd need to verify the app (requires Google review)

### Data not syncing across devices

- Check browser console for sync errors
- Make sure you're signed in with the same Google account on both devices
- Click "Sync Now" to manually trigger a sync

## Production Deployment

Before deploying to production:

1. **Update authorized origins**:

   - Add your production domain to OAuth credentials
   - Remove localhost URLs from production build

2. **Verify your app** (optional but recommended):

   - Go to OAuth consent screen in Cloud Console
   - Submit for verification
   - This removes the "unverified app" warning

3. **Monitor usage**:
   - Check [Google Cloud Console](https://console.cloud.google.com/) for API usage
   - Google Drive API has generous free quotas (should be more than enough)

## Cost

Google Drive API is **FREE** for most use cases:

- **Free quota**: 20,000 requests per day per user
- Word Master Challenge uses ~2-5 requests per sync
- You'd need to sync 4,000+ times per day to hit the limit

## Support

If you run into issues:

- Check the [Google Drive API documentation](https://developers.google.com/drive/api/guides/about-sdk)
- Review the [OAuth 2.0 documentation](https://developers.google.com/identity/protocols/oauth2)
- Look for errors in browser console (F12)

---

**Last updated**: 2025-11-29
