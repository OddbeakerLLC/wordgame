# Progressive Web App (PWA) Features

Word Quest is a fully-featured Progressive Web App that can be installed on any device and works offline!

## Features

✅ **Installable** - Add to home screen on mobile devices
✅ **Offline Support** - Works without internet connection (after first load)
✅ **Fast Loading** - Cached assets for instant startup
✅ **Native-like Experience** - Full-screen, no browser chrome
✅ **Auto-updates** - Service worker automatically updates the app

## Installation

### On Mobile (iOS/Android)
1. Open Word Quest in your mobile browser
2. Tap the browser menu (three dots or share button)
3. Select "Add to Home Screen" or "Install App"
4. The app icon will appear on your home screen!

### On Desktop (Chrome, Edge)
1. Open Word Quest in your browser
2. Look for the install button in the address bar
3. Click "Install"
4. The app will open in its own window

## Generating App Icons

We need PNG icons for the app to be installable. Follow these steps:

### Option 1: Using the Icon Generator Tool
1. Open `tools/generate-icons.html` in a web browser
2. Click the "Download 192x192" button and save as `public/icon-192.png`
3. Click the "Download 512x512" button and save as `public/icon-512.png`

### Option 2: Using an Online Converter
1. Upload `public/icon.svg` to an SVG-to-PNG converter (like CloudConvert)
2. Generate 192x192 and 512x512 versions
3. Save them as `public/icon-192.png` and `public/icon-512.png`

### Option 3: Using Command Line (if you have ImageMagick)
```bash
# From the project root
convert public/icon.svg -resize 192x192 public/icon-192.png
convert public/icon.svg -resize 512x512 public/icon-512.png
```

## How It Works

### Service Worker
The app uses a service worker (`public/sw.js`) to:
- Cache essential files for offline use
- Serve cached content when offline
- Update automatically in the background

### Web App Manifest
The manifest (`public/manifest.json`) tells browsers:
- App name and description
- Theme colors
- Icons to use
- Display mode (standalone)
- Start URL

### Vite PWA Plugin
We use `vite-plugin-pwa` which:
- Automatically generates the service worker
- Injects the manifest
- Handles asset caching with Workbox
- Provides development mode testing

## Testing PWA Features

### In Development
The PWA features work in development mode! Just run:
```bash
npm run dev
```

Then open DevTools:
1. Go to Application tab
2. Check "Service Workers" - should show registered worker
3. Check "Manifest" - should show app details
4. Try "Offline" mode in Network tab

### In Production
Build and preview:
```bash
npm run build
npm run preview
```

The production build will have optimized caching and service worker.

## Offline Functionality

What works offline:
- ✅ All UI components and navigation
- ✅ Child profiles (stored in IndexedDB)
- ✅ Word queues and progress
- ✅ Drill and quiz modes
- ✅ Sound effects
- ✅ Text-to-speech (uses device TTS)

What requires internet (on first load):
- Google Fonts (cached after first load)
- Initial app assets

## Browser Support

The PWA features work in:
- ✅ Chrome/Edge (full support)
- ✅ Safari iOS 16.4+ (good support)
- ✅ Firefox (service worker support)
- ✅ Samsung Internet
- ⚠️ Safari Desktop (limited install prompt)

## Troubleshooting

### "Add to Home Screen" not showing?
- Make sure you're using HTTPS (or localhost)
- Check that manifest.json is accessible
- Verify service worker is registered in DevTools

### App not updating?
- Service worker updates automatically
- Force update: Clear cache in DevTools
- Or uninstall and reinstall the app

### Icons not showing?
- Make sure icon-192.png and icon-512.png exist in public/
- Check browser console for 404 errors
- Regenerate icons using the tool

## Future Enhancements

Potential PWA improvements:
- 📱 Push notifications for daily quiz reminders
- 🔄 Background sync for cloud backup
- 📊 Web Share API for sharing progress
- 📸 File System API for importing word lists
- 🎵 Background Audio API for ambient sounds
