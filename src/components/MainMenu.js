import { getWords } from '../services/storage.js';
import audio from '../services/audio.js';

/**
 * Main Menu Component
 */
export async function renderMainMenu(container, child, handlers) {
  const words = await getWords(child.id);

  container.innerHTML = `
    <div class="flex justify-center">
      <div class="card max-w-2xl w-full">
        <div class="text-center mb-8">
          <h1 class="text-4xl md:text-5xl font-bold text-primary-600 mb-2">
            Hi, ${escapeHtml(child.name)}!
          </h1>
          <p class="text-xl text-gray-600">
            Ready to practice your words?
          </p>
        </div>

        <div class="space-y-4 mb-8">
          ${words.length > 0 ? `
            <button id="daily-quiz-btn" class="btn-primary w-full py-6 text-2xl">
              Start a Challenge
            </button>
            <div class="bg-gray-50 rounded-xl p-4 text-center">
              <p class="text-sm text-gray-600">
                ${words.length} word${words.length === 1 ? '' : 's'} in your queue
              </p>
            </div>
          ` : `
            <div class="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 text-center">
              <p class="text-lg text-gray-700 mb-4">
                No words yet! Ask a parent or teacher to add some words for you to practice.
              </p>
            </div>
          `}
        </div>

        <div class="border-t-2 border-gray-200 pt-6 space-y-3">
          <button id="change-child-btn" class="btn-secondary w-full">
            Change Player
          </button>

          <div class="text-center">
            <button id="about-btn" class="text-sm text-gray-600 hover:text-primary-600 underline">
              About • Privacy • Terms
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  const dailyQuizBtn = container.querySelector('#daily-quiz-btn');
  if (dailyQuizBtn) {
    dailyQuizBtn.addEventListener('click', () => {
      audio.playClick();
      handlers.onDailyQuiz();
    });
  }

  container.querySelector('#change-child-btn').addEventListener('click', () => {
    audio.playClick();
    handlers.onChangeChild();
  });

  container.querySelector('#about-btn').addEventListener('click', () => {
    audio.playClick();
    if (handlers.onAbout) {
      handlers.onAbout();
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
