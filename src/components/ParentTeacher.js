import { getChildren, getWords, createWord, deleteWord, deleteChild, updateChild } from '../services/storage.js';
import audio from '../services/audio.js';

/**
 * Parent/Teacher Interface Component
 */
export async function renderParentTeacher(container, onBack) {
  const children = await getChildren();

  container.innerHTML = `
    <div class="p-4">
      <div class="max-w-4xl mx-auto">
        <div class="card mb-6">
          <div class="flex items-center justify-between mb-6">
            <h1 class="text-3xl font-bold text-primary-600">Parent/Teacher</h1>
            <button id="back-btn" class="btn-secondary">
              ← Back
            </button>
          </div>

          ${children.length === 0 ? `
            <div class="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 text-center">
              <p class="text-lg text-gray-700">
                No child profiles yet. Go back and create one first!
              </p>
            </div>
          ` : `
            <div class="mb-6">
              <label class="block text-lg font-semibold text-gray-700 mb-2">
                Select Child
              </label>
              <select id="child-select" class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                     focus:border-primary-500 focus:outline-none">
                ${children.map(child => `
                  <option value="${child.id}">${escapeHtml(child.name)}</option>
                `).join('')}
              </select>
            </div>

            <div id="child-details">
              <!-- Child details will be loaded here -->
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Event listeners
  container.querySelector('#back-btn').addEventListener('click', () => {
    audio.playClick();
    onBack();
  });

  if (children.length > 0) {
    const childSelect = container.querySelector('#child-select');

    // Load first child by default
    await loadChildDetails(container, parseInt(childSelect.value));

    // Handle child selection change
    childSelect.addEventListener('change', async () => {
      audio.playClick();
      await loadChildDetails(container, parseInt(childSelect.value));
    });
  }
}

/**
 * Load and display child details
 */
async function loadChildDetails(container, childId) {
  const children = await getChildren();
  const child = children.find(c => c.id === childId);
  if (!child) return;

  const words = await getWords(childId);
  const detailsContainer = container.querySelector('#child-details');

  detailsContainer.innerHTML = `
    <div class="border-t-2 border-gray-200 pt-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">
        ${escapeHtml(child.name)}'s Settings
      </h2>

      <div class="mb-6 p-4 bg-gray-50 rounded-lg">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Input Method
            </label>
            <select id="input-method" class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none">
              <option value="keyboard" ${child.inputMethod === 'keyboard' ? 'selected' : ''}>Keyboard Only</option>
              <option value="onscreen" ${child.inputMethod === 'onscreen' ? 'selected' : ''}>On-Screen Letters</option>
              <option value="hybrid" ${child.inputMethod === 'hybrid' ? 'selected' : ''}>Both (Hybrid)</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Quiz Length (words to complete)
            </label>
            <input type="number" id="quiz-length" min="1" max="20" value="${child.quizLength}"
                   class="w-full px-3 py-2 border-2 border-gray-300 rounded-lg
                          focus:border-primary-500 focus:outline-none">
          </div>
        </div>

        <button id="save-settings-btn" class="btn-primary">
          Save Settings
        </button>
      </div>

      <div class="border-t-2 border-gray-200 pt-6">
        <h3 class="text-xl font-bold text-gray-800 mb-4">
          Word Queue (${words.length} words)
        </h3>

        <div class="mb-4">
          <form id="add-word-form" class="flex gap-2">
            <input
              type="text"
              id="word-input"
              placeholder="Enter a new word"
              class="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                     focus:border-primary-500 focus:outline-none"
              required>
            <button type="submit" class="btn-primary">
              Add Word
            </button>
          </form>
        </div>

        ${words.length > 0 ? `
          <div class="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            <div class="max-h-96 overflow-y-auto">
              <table class="w-full">
                <thead class="bg-gray-100 sticky top-0">
                  <tr>
                    <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Position</th>
                    <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Word</th>
                    <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stats</th>
                    <th class="px-4 py-3 text-left text-sm font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody id="word-list">
                  ${words.map((word, index) => `
                    <tr class="border-t border-gray-200 hover:bg-gray-50">
                      <td class="px-4 py-3 text-gray-600">#${index + 1}</td>
                      <td class="px-4 py-3 font-semibold text-gray-800">${escapeHtml(word.text)}</td>
                      <td class="px-4 py-3">
                        ${word.drilled
                          ? '<span class="text-green-600">✓ Drilled</span>'
                          : '<span class="text-yellow-600">⊙ New</span>'}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-600">
                        ${word.attempts > 0
                          ? `${word.successes}/${word.attempts} (${word.errors} errors)`
                          : 'Not practiced'}
                      </td>
                      <td class="px-4 py-3">
                        <button class="delete-word-btn text-red-600 hover:text-red-800 font-semibold"
                                data-word-id="${word.id}">
                          Delete
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="bg-blue-50 border-2 border-blue-300 rounded-xl p-6 text-center">
            <p class="text-lg text-gray-700">
              No words yet. Add some words above to get started!
            </p>
          </div>
        `}
      </div>

      <div class="border-t-2 border-gray-200 pt-6 mt-6">
        <button id="delete-child-btn" class="btn-secondary text-red-600 border-red-600 hover:bg-red-50">
          Delete ${escapeHtml(child.name)}'s Profile
        </button>
      </div>
    </div>
  `;

  // Add event listeners
  attachChildDetailsListeners(container, child, detailsContainer);
}

/**
 * Attach event listeners to child details
 */
function attachChildDetailsListeners(container, child, detailsContainer) {
  // Save settings
  detailsContainer.querySelector('#save-settings-btn').addEventListener('click', async () => {
    audio.playClick();
    const inputMethod = detailsContainer.querySelector('#input-method').value;
    const quizLength = parseInt(detailsContainer.querySelector('#quiz-length').value);

    await updateChild(child.id, { inputMethod, quizLength });

    // Show feedback
    const btn = detailsContainer.querySelector('#save-settings-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Saved!';
    btn.classList.add('bg-green-600');
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('bg-green-600');
    }, 1500);
  });

  // Add word form
  detailsContainer.querySelector('#add-word-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    audio.playClick();

    const input = detailsContainer.querySelector('#word-input');
    const wordText = input.value.trim().toLowerCase();

    if (wordText) {
      try {
        await createWord({ text: wordText, childId: child.id });
        input.value = '';

        // Reload child details
        await loadChildDetails(container, child.id);

        // Show success message
        audio.playSuccess();

        // Refocus the input for continuous entry
        const newInput = container.querySelector('#word-input');
        if (newInput) {
          newInput.focus();
        }
      } catch (error) {
        console.error('Error adding word:', error);
        alert('Error adding word: ' + error.message);
      }
    }
  });

  // Delete word buttons
  detailsContainer.querySelectorAll('.delete-word-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      audio.playClick();
      const wordId = parseInt(btn.dataset.wordId);

      if (confirm('Are you sure you want to delete this word?')) {
        await deleteWord(wordId);
        await loadChildDetails(container, child.id);
        audio.playSuccess();
      }
    });
  });

  // Delete child button
  detailsContainer.querySelector('#delete-child-btn').addEventListener('click', async () => {
    audio.playClick();

    const confirmText = prompt(
      `This will permanently delete ${child.name}'s profile and all their words.\n\n` +
      `Type "${child.name}" to confirm:`
    );

    if (confirmText === child.name) {
      await deleteChild(child.id);

      // Reload the parent interface
      const children = await getChildren();
      if (children.length > 0) {
        await loadChildDetails(container, children[0].id);
        // Update the select dropdown
        const select = container.querySelector('#child-select');
        select.innerHTML = children.map(c => `
          <option value="${c.id}">${escapeHtml(c.name)}</option>
        `).join('');
      } else {
        // No more children, reload the whole interface
        location.reload();
      }
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
