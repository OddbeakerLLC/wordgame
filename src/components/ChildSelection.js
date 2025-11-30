import { getChildren } from '../services/storage.js';
import audio from '../services/audio.js';

/**
 * Child Selection Screen
 */
export async function renderChildSelection(container, onChildSelected, onParentTeacher, onAbout) {
  const children = await getChildren();

  container.innerHTML = `
    <div class="flex justify-center">
      <div class="card max-w-2xl w-full">
        ${children.length > 0 ? `
          <h2 class="text-2xl font-bold text-gray-700 mb-6 text-center">
            Who's playing today?
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            ${children.map(child => `
              <button
                class="child-btn p-6 bg-gradient-to-br from-primary-500 to-purple-500
                       text-white rounded-xl shadow-lg hover:scale-105 transition-transform
                       font-bold text-2xl"
                data-child-id="${child.id}">
                ${escapeHtml(child.name)}
              </button>
            `).join('')}
          </div>
        ` : `
          <h2 class="text-2xl font-bold text-gray-700 mb-6 text-center">
            Let's get started!
          </h2>
          <p class="text-lg text-gray-600 mb-6 text-center">
            Click Parent/Teacher below to create your first player profile
          </p>
        `}

        <div class="border-t-2 border-gray-200 pt-6 space-y-3">
          <button id="parent-teacher-btn" class="btn-secondary w-full">
            Parent/Teacher
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

  // Add event listeners
  container.querySelectorAll('.child-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      audio.playClick();
      const childId = parseInt(btn.dataset.childId);
      const children = await getChildren();
      const child = children.find(c => c.id === childId);
      if (child) {
        onChildSelected(child);
      }
    });
  });

  container.querySelector('#parent-teacher-btn').addEventListener('click', () => {
    audio.playClick();
    if (onParentTeacher) {
      onParentTeacher();
    }
  });

  container.querySelector('#about-btn').addEventListener('click', () => {
    audio.playClick();
    if (onAbout) {
      onAbout();
    }
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
