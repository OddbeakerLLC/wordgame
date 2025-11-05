import './styles/main.css';
import { initDB } from './services/storage.js';
import { renderApp } from './components/App.js';
import tts from './services/tts.js';

// Initialize the application
async function init() {
  try {
    // Initialize IndexedDB
    await initDB();

    // Start loading TTS (including HeadTTS) in background immediately
    // Don't await - let it load while user navigates
    tts.init().catch(err => console.error('TTS initialization error:', err));

    // Render the main app
    const app = document.getElementById('app');
    renderApp(app);
  } catch (error) {
    console.error('Failed to initialize Word Quest:', error);
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-4">
        <div class="card max-w-md">
          <h1 class="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h1>
          <p class="text-gray-700 mb-4">We couldn't start Word Quest. Please refresh the page to try again.</p>
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
