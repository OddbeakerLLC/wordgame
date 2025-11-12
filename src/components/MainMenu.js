import { getWords, getUndrilledWords } from '../services/storage.js';
import audio from '../services/audio.js';

/**
 * Main Menu Component
 */
export async function renderMainMenu(container, child, handlers) {
  const words = await getWords(child.id);
  const undrilledWords = await getUndrilledWords(child.id);

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
          ${words.length > 0 && undrilledWords.length === 0 ? `
            <button id="daily-quiz-btn" class="btn-primary w-full py-6 text-2xl">
              Daily Quiz
            </button>
          ` : ''}

          ${undrilledWords.length > 0 ? `
            <div class="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 text-center">
              <p class="text-lg font-semibold text-yellow-800 mb-3">
                You have ${undrilledWords.length} new word${undrilledWords.length === 1 ? '' : 's'} to learn!
              </p>
              <button id="drill-btn" class="btn-primary">
                Start Learning
              </button>
            </div>
          ` : ''}

          ${words.length === 0 ? `
            <div class="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 text-center">
              <p class="text-lg text-gray-700 mb-4">
                No words yet! Ask a parent or teacher to add some words for you to practice.
              </p>
            </div>
          ` : `
            <div class="bg-gray-50 rounded-xl p-4 text-center">
              <p class="text-sm text-gray-600">
                ${words.length} word${words.length === 1 ? '' : 's'} in your queue
              </p>
            </div>
          `}
        </div>

        <div class="border-t-2 border-gray-200 pt-6">
          <button id="change-child-btn" class="btn-secondary w-full">
            Change Player
          </button>
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

  const drillBtn = container.querySelector('#drill-btn');
  if (drillBtn) {
    drillBtn.addEventListener('click', () => {
      audio.playClick();
      handlers.onDrill();
    });
  }

  container.querySelector('#change-child-btn').addEventListener('click', () => {
    audio.playClick();
    handlers.onChangeChild();
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
