# Quick Setup: ElevenLabs TTS

Follow these steps to enable high-quality text-to-speech in Word Master Challenge.

## Step 1: Get Your API Key

1. Go to [elevenlabs.io](https://elevenlabs.io) and create an account
2. Navigate to **Settings** → **API Keys**
3. Click **Generate API Key**
4. Copy the key (starts with `sk_...`)

## Step 2: Configure the App

Create a config file with your API key:

```bash
cp config.example.php config.php
```

Edit `config.php` and replace `your-api-key-here` with your actual key:

```php
define('ELEVENLABS_API_KEY', 'sk_your_actual_key_here');
```

**Important:** The `config.php` file is already in `.gitignore` and won't be committed to git.

## Step 2.5: Deploy PHP API to Your Web Server

The `api/tts.php` file needs to be served by a PHP-enabled web server (Apache, Nginx, or PHP built-in server).

**Option A: Copy to your web server's document root**
```bash
# Example for Apache
cp -r api /var/www/html/wordmaster/
cp config.php /var/www/html/wordmaster/
```

**Option B: Use PHP's built-in server (for testing)**
```bash
# In a separate terminal
cd /home/tmanso/dev/wordgame
php -S localhost:8080
```

The PHP API will be available at:
- Apache/Nginx: `http://localhost/wordmaster/api/tts.php`
- PHP built-in: `http://localhost:8080/api/tts.php`

## Step 3: Test the Integration

Open the bulk generation tool in your browser:

```
http://localhost:3000/wordmaster/generate-audio.html
```

Or open directly from file system:
```
file:///home/tmanso/dev/wordgame/tools/generate-audio.html
```

Click "Start Bulk Generation" to test. If it works, you'll see:
- ✓ Generated "the" (X.X KB)
- ✓ Generated "be" (X.X KB)
- etc.

## That's It!

Your app now has premium TTS:

- **Adding words**: Audio automatically generated
- **Loading 100 common words**: Option to generate audio for all
- **Practice/Quiz**: Uses cached high-quality audio

## Pricing

- **Free tier**: 10,000 characters/month (~1,000-2,000 words)
- **Starter**: $5/month for 30,000 characters (~3,000-6,000 words)

**Generating 100 common words costs ~$0.08**

## Without ElevenLabs

Don't have an API key? No problem!

The app works perfectly with the built-in Web Speech API. ElevenLabs is optional for enhanced quality.

---

For detailed documentation, see [docs/ELEVENLABS-TTS.md](docs/ELEVENLABS-TTS.md)
