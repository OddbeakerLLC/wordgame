import { getChildren, createChild } from '../services/storage.js';
import audio from '../services/audio.js';

/**
 * Child Selection Screen
 */
export async function renderChildSelection(container, onChildSelected) {
  const children = await getChildren();

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="card max-w-2xl w-full">
        <h1 class="text-4xl md:text-5xl font-bold text-center text-primary-600 mb-8">
          Word Quest
        </h1>

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
            Create your first player profile to begin
          </p>
        `}

        <div class="border-t-2 border-gray-200 pt-6">
          <button id="add-child-btn" class="btn-secondary w-full">
            + Add New Player
          </button>
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

  container.querySelector('#add-child-btn').addEventListener('click', () => {
    audio.playClick();
    showAddChildModal(container, onChildSelected);
  });
}

/**
 * Show modal to add new child
 */
function showAddChildModal(container, onChildSelected) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  modal.innerHTML = `
    <div class="card max-w-md w-full">
      <h3 class="text-2xl font-bold text-gray-800 mb-4">Add New Player</h3>

      <form id="add-child-form">
        <div class="mb-4">
          <label class="block text-lg font-semibold text-gray-700 mb-2">
            Player Name
          </label>
          <input
            type="text"
            id="child-name-input"
            class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none"
            placeholder="Enter name"
            required
            autofocus>
        </div>

        <div class="mb-6">
          <label class="block text-lg font-semibold text-gray-700 mb-2">
            Input Method
          </label>
          <select
            id="input-method-select"
            class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none">
            <option value="keyboard">Keyboard Only</option>
            <option value="onscreen">On-Screen Letters</option>
            <option value="hybrid">Both (Hybrid)</option>
          </select>
          <p class="text-sm text-gray-600 mt-2">
            Choose how the player will spell words
          </p>
        </div>

        <div class="flex gap-3">
          <button type="submit" class="btn-primary flex-1">
            Create Profile
          </button>
          <button type="button" id="cancel-btn" class="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Focus on input
  const input = modal.querySelector('#child-name-input');
  setTimeout(() => input.focus(), 100);

  // Handle form submission
  modal.querySelector('#add-child-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    audio.playClick();

    const name = input.value.trim();
    const inputMethod = modal.querySelector('#input-method-select').value;

    if (name) {
      try {
        const child = await createChild({ name, inputMethod });
        console.log('Child created:', child);
        document.body.removeChild(modal);

        // Refresh the view
        await renderChildSelection(container, onChildSelected);

        // Auto-select if this is the first child
        const children = await getChildren();
        console.log('Total children:', children.length);
        if (children.length === 1) {
          console.log('Auto-selecting first child');
          onChildSelected(child);
        }
      } catch (error) {
        console.error('Error creating child:', error);
        alert('Error creating profile: ' + error.message);
      }
    }
  });

  // Handle cancel
  modal.querySelector('#cancel-btn').addEventListener('click', () => {
    audio.playClick();
    document.body.removeChild(modal);
  });

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      audio.playClick();
      document.body.removeChild(modal);
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
