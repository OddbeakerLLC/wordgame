import './styles/main.css';
import { initDB } from './services/storage.js';
import { renderApp } from './components/App.js';
import tts from './services/tts.js';
import { initializeAllAudio } from './services/audioLoader.js';
import { loadLetterAudioFromFiles } from './services/systemAudio.js';

// Initialize the application
async function init() {
  try {
    // Initialize IndexedDB
    await initDB();

    // Start loading TTS (including HeadTTS) in background immediately
    // Don't await - let it load while user navigates
    tts.init().catch(err => console.error('TTS initialization error:', err));

    // Load letter audio from MP3 files in public/sounds/
    loadLetterAudioFromFiles()
      .then(() => console.log('✓ Letter audio MP3 files loaded'))
      .catch(err => console.warn('Letter audio loading failed:', err));

    // Load pre-generated audio from server (system audio + common words)
    // This runs in background - app works fine even if it fails
    initializeAllAudio()
      .then(results => {
        if (results.systemAudio) {
          console.log('✓ System audio (alphabet + prompts) loaded from JSON');
        }
        if (results.commonWordsAudio) {
          console.log('✓ Common words audio available');
        }
      })
      .catch(err => console.warn('Audio loading skipped:', err));

    // Render the main app
    const app = document.getElementById('app');
    renderApp(app);
  } catch (error) {
    console.error('Failed to initialize Word Master Challenge:', error);
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="card max-w-md">
          <h1 class="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h1>
          <p class="text-gray-700 mb-4">We couldn't start Word Master Challenge. Please refresh the page to try again.</p>
          <button onclick="location.reload()" class="btn-primary w-full">
            Refresh Page
          </button>
        </div>
      </div>
    `;
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
