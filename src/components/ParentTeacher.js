import { getChildren, getWords, createWord, deleteWord, deleteChild, updateChild, createChild, importCommonWords } from '../services/storage.js';
import audio from '../services/audio.js';
import { COMMON_WORDS } from '../data/commonWords.js';
import * as googleSync from '../services/googleDriveSync.js';
import { renderApp } from './App.js';

/**
 * Generate a random simple math problem with a 1-digit answer
 */
function generateMathProblem() {
  const answer = Math.floor(Math.random() * 10); // 0-9
  const operations = ['+', '-', '×', '÷'];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let num1, num2;

  switch(op) {
    case '+':
      num2 = Math.floor(Math.random() * answer);
      num1 = answer - num2;
      break;
    case '-':
      num2 = Math.floor(Math.random() * 10);
      num1 = answer + num2;
      break;
    case '×':
      if (answer === 0) {
        num1 = 0;
        num2 = Math.floor(Math.random() * 10);
      } else {
        const divisors = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => answer % d === 0);
        num2 = divisors[Math.floor(Math.random() * divisors.length)] || 1;
        num1 = answer / num2;
      }
      break;
    case '÷':
      num2 = Math.floor(Math.random() * 9) + 1;
      num1 = answer * num2;
      break;
  }

  return { num1, num2, op, answer };
}

/**
 * Show math challenge before allowing access to Parent/Teacher interface
 */
function showMathChallenge(container, onSuccess, onBack) {
  const problem = generateMathProblem();

  container.innerHTML = `
    <div class="p-4">
      <div class="max-w-md mx-auto">
        <div class="card">
          <div class="text-center mb-6">
            <h1 class="text-3xl font-bold text-primary-600 mb-2">Parent/Teacher Access</h1>
            <p class="text-gray-600">Solve this problem to continue:</p>
          </div>

          <div class="bg-primary-50 rounded-xl p-8 mb-6 text-center">
            <div class="text-5xl font-bold text-primary-700 mb-4">
              ${problem.num1} ${problem.op} ${problem.num2} = ?
            </div>
          </div>

          <form id="math-form" class="space-y-4">
            <div>
              <input
                type="number"
                id="answer-input"
                placeholder="Your answer"
                class="w-full px-6 py-4 text-2xl text-center border-2 border-gray-300 rounded-lg
                       focus:border-primary-500 focus:outline-none"
                min="0"
                max="9"
                required
                autofocus>
            </div>

            <div id="error-message" class="text-red-600 text-center font-semibold hidden">
              Incorrect. Try again!
            </div>

            <div class="flex gap-3">
              <button type="button" id="back-btn" class="btn-secondary flex-1">
                ← Back
              </button>
              <button type="submit" class="btn-primary flex-1">
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  const form = container.querySelector('#math-form');
  const input = container.querySelector('#answer-input');
  const errorMessage = container.querySelector('#error-message');

  // Focus the input field
  input.focus();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    audio.playClick();

    const userAnswer = parseInt(input.value);

    if (userAnswer === problem.answer) {
      audio.playSuccess();
      onSuccess();
    } else {
      audio.playBuzz();
      setTimeout(() => {
        onBack();
      }, 500);
    }
  });

  container.querySelector('#back-btn').addEventListener('click', () => {
    audio.playClick();
    onBack();
  });
}

/**
 * Parent/Teacher Interface Component
 */
export async function renderParentTeacher(container, onBack, selectedChildId) {
  // Show math challenge first
  showMathChallenge(container, async () => {
    await showParentTeacherInterface(container, onBack, selectedChildId);
  }, onBack);
}

/**
 * Show the actual Parent/Teacher interface (after math challenge)
 */
async function showParentTeacherInterface(container, onBack, selectedChildId) {
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

          <!-- Cloud Sync Section -->
          <div id="cloud-sync-section" class="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-bold text-gray-800 mb-1">☁️ Cloud Sync</h3>
                <p id="sync-status-text" class="text-sm text-gray-600">
                  Not connected
                </p>
              </div>
              <div class="flex gap-2">
                <button id="connect-drive-btn" class="btn-primary whitespace-nowrap">
                  Connect Google Drive
                </button>
                <button id="sync-now-btn" class="btn-secondary hidden">
                  Sync Now
                </button>
                <button id="disconnect-drive-btn" class="btn-secondary text-red-600 border-red-600 hover:bg-red-50 hidden">
                  Disconnect
                </button>
              </div>
            </div>
          </div>

          <div class="mb-6">
            <label class="block text-lg font-semibold text-gray-700 mb-2">
              Select Child
            </label>
            <select id="child-select" class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none">
              ${children.map(child => `
                <option value="${child.id}">${escapeHtml(child.name)}</option>
              `).join('')}
              <option value="add-new">+ Add New Child</option>
            </select>
          </div>

          <div id="child-details">
            <!-- Child details or add form will be loaded here -->
          </div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  container.querySelector('#back-btn').addEventListener('click', () => {
    audio.playClick();
    onBack();
  });

  // Initialize cloud sync
  setupCloudSync(container);

  const childSelect = container.querySelector('#child-select');

  // Load appropriate child
  if (children.length > 0) {
    // Set dropdown to selected child ID or first child
    if (selectedChildId && children.some(c => c.id === selectedChildId)) {
      childSelect.value = selectedChildId;
    }

    const childIdToLoad = parseInt(childSelect.value);
    await loadChildDetails(container, childIdToLoad);
  } else {
    // No children yet, show the add form
    showAddChildForm(container, onBack);
  }

  // Handle child selection change
  childSelect.addEventListener('change', async () => {
    audio.playClick();
    const selectedValue = childSelect.value;

    if (selectedValue === 'add-new') {
      showAddChildForm(container, onBack);
    } else {
      await loadChildDetails(container, parseInt(selectedValue));
    }
  });
}

/**
 * Show form to add a new child
 */
function showAddChildForm(container, onBack) {
  const detailsContainer = container.querySelector('#child-details');

  detailsContainer.innerHTML = `
    <div class="border-t-2 border-gray-200 pt-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">
        Add New Child
      </h2>

      <form id="add-child-form" class="space-y-6">
        <div>
          <label class="block text-lg font-semibold text-gray-700 mb-2">
            Child Name
          </label>
          <input
            type="text"
            id="child-name-input"
            class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none"
            placeholder="Enter child's name"
            required
            autofocus>
        </div>

        <div>
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
            Choose how the child will spell words
          </p>
        </div>

        <div>
          <label class="block text-lg font-semibold text-gray-700 mb-2">
            Quiz Length
          </label>
          <input
            type="number"
            id="quiz-length-input"
            min="1"
            max="20"
            value="10"
            class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none">
          <p class="text-sm text-gray-600 mt-2">
            Number of words per quiz session (1-20)
          </p>
        </div>

        <div>
          <label class="block text-lg font-semibold text-gray-700 mb-2">
            Drill Length
          </label>
          <input
            type="number"
            id="drill-length-input"
            min="1"
            max="20"
            value="5"
            class="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg
                   focus:border-primary-500 focus:outline-none">
          <p class="text-sm text-gray-600 mt-2">
            Number of new words to learn per drill session (1-20)
          </p>
        </div>

        <button type="submit" class="btn-primary w-full">
          Create Child Profile
        </button>
      </form>
    </div>
  `;

  // Focus on name input
  const nameInput = detailsContainer.querySelector('#child-name-input');
  setTimeout(() => nameInput.focus(), 100);

  // Handle form submission
  detailsContainer.querySelector('#add-child-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    audio.playClick();

    const name = nameInput.value.trim();
    const inputMethod = detailsContainer.querySelector('#input-method-select').value;
    const quizLength = parseInt(detailsContainer.querySelector('#quiz-length-input').value);
    const drillLength = parseInt(detailsContainer.querySelector('#drill-length-input').value);

    if (name) {
      try {
        const newChild = await createChild({ name, inputMethod, quizLength, drillLength });
        audio.playSuccess();

        // Reload the parent interface with the new child selected
        await showParentTeacherInterface(container, onBack, newChild.id);
      } catch (error) {
        console.error('Error creating child:', error);
        alert('Error creating profile: ' + error.message);
      }
    }
  });
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

  // Calculate how many common words are present
  const existingWordTexts = new Set(words.map(w => w.text.toLowerCase()));
  const commonWordsPresent = COMMON_WORDS.filter(word =>
    existingWordTexts.has(word.toLowerCase())
  ).length;
  const missingCommonWords = COMMON_WORDS.length - commonWordsPresent;

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

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              Drill Length (new words per session)
            </label>
            <input type="number" id="drill-length" min="1" max="20" value="${child.drillLength || 5}"
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

        ${missingCommonWords > 0 ? `
          <div class="mb-4 p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <h4 class="font-semibold text-gray-800 mb-1">Quick Start: Load Common Words</h4>
                <p class="text-sm text-gray-600">
                  Add the ${missingCommonWords} remaining common word${missingCommonWords !== 1 ? 's' : ''} to the queue
                  ${commonWordsPresent > 0 ? `(${commonWordsPresent} already added)` : ''}
                </p>
              </div>
              <button id="load-common-words-btn" class="btn-primary whitespace-nowrap">
                Load ${missingCommonWords} Word${missingCommonWords !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        ` : `
          <div class="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
            <div class="flex items-center gap-3">
              <div class="text-green-600 text-2xl">✓</div>
              <div>
                <h4 class="font-semibold text-gray-800 mb-1">All 100 common words loaded!</h4>
                <p class="text-sm text-gray-600">Great job! You can add more words manually above.</p>
              </div>
            </div>
          </div>
        `}

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
    const drillLength = parseInt(detailsContainer.querySelector('#drill-length').value);

    await updateChild(child.id, { inputMethod, quizLength, drillLength });

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

  // Load common words button (only exists if there are missing words)
  const loadCommonWordsBtn = detailsContainer.querySelector('#load-common-words-btn');
  if (loadCommonWordsBtn) {
    loadCommonWordsBtn.addEventListener('click', async () => {
      audio.playClick();
      const btn = detailsContainer.querySelector('#load-common-words-btn');
      const originalText = btn.textContent;

      // Disable button and show loading state
      btn.disabled = true;
      btn.textContent = 'Loading...';

      try {
        const result = await importCommonWords(child.id, COMMON_WORDS);

        // Show success feedback
        audio.playSuccess();
        btn.textContent = `Added ${result.added} word${result.added !== 1 ? 's' : ''}!`;
        btn.classList.add('bg-green-600');

        // Reload child details after a short delay
        setTimeout(async () => {
          await loadChildDetails(container, child.id);
        }, 1500);

      } catch (error) {
        console.error('Error loading common words:', error);
        audio.playBuzz();
        btn.textContent = 'Error!';
        btn.classList.add('bg-red-600');

        setTimeout(() => {
          btn.textContent = originalText;
          btn.classList.remove('bg-red-600');
          btn.disabled = false;
        }, 2000);
      }
    });
  }

  // Add word form
  detailsContainer.querySelector('#add-word-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    audio.playClick();

    const input = detailsContainer.querySelector('#word-input');
    const wordText = input.value.trim().toLowerCase();

    if (wordText) {
      // Check for duplicates
      const existingWords = await getWords(child.id);
      const isDuplicate = existingWords.some(w => w.text.toLowerCase() === wordText);

      if (isDuplicate) {
        audio.playBuzz();
        input.classList.add('border-red-500', 'shake');

        // Show error message
        let errorMsg = detailsContainer.querySelector('#word-error-msg');
        if (!errorMsg) {
          errorMsg = document.createElement('p');
          errorMsg.id = 'word-error-msg';
          errorMsg.className = 'text-red-600 text-sm font-semibold mt-2';
          input.parentElement.appendChild(errorMsg);
        }
        errorMsg.textContent = `"${wordText}" is already in the word list!`;

        setTimeout(() => {
          input.classList.remove('border-red-500', 'shake');
          if (errorMsg) {
            errorMsg.remove();
          }
        }, 2000);
        return;
      }

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
      audio.playSuccess();

      // Reload the parent interface completely
      const children = await getChildren();
      if (children.length > 0) {
        // Update the select dropdown with all children + "Add New Child" option
        const select = container.querySelector('#child-select');
        select.innerHTML = children.map(c => `
          <option value="${c.id}">${escapeHtml(c.name)}</option>
        `).join('') + '<option value="add-new">+ Add New Child</option>';

        // Set dropdown to first child and load their details
        select.value = children[0].id;
        await loadChildDetails(container, children[0].id);
      } else {
        // No more children, reload parent interface to show "Add New Child" form
        await showParentTeacherInterface(container, onBack, null);
      }
    }
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup cloud sync UI and event listeners
 */
async function setupCloudSync(container) {
  const connectBtn = container.querySelector('#connect-drive-btn');
  const syncBtn = container.querySelector('#sync-now-btn');
  const disconnectBtn = container.querySelector('#disconnect-drive-btn');
  const statusText = container.querySelector('#sync-status-text');

  // Initialize Google API
  try {
    await googleSync.autoInit();
  } catch (error) {
    console.error('Failed to initialize Google Drive sync:', error);
    statusText.textContent = 'Cloud sync unavailable';
    connectBtn.disabled = true;
    return;
  }

  // Update UI based on connection status
  const updateSyncUI = (status) => {
    const isConnected = googleSync.isSignedIn();

    if (isConnected) {
      connectBtn.classList.add('hidden');
      syncBtn.classList.remove('hidden');
      disconnectBtn.classList.remove('hidden');

      if (status?.syncing) {
        statusText.textContent = 'Syncing...';
        syncBtn.disabled = true;
      } else {
        const lastSync = googleSync.getLastSyncTime();
        if (lastSync) {
          const date = new Date(lastSync);
          statusText.textContent = `Last synced: ${date.toLocaleString()}`;
        } else {
          statusText.textContent = 'Connected';
        }
        syncBtn.disabled = false;
      }
    } else {
      connectBtn.classList.remove('hidden');
      syncBtn.classList.add('hidden');
      disconnectBtn.classList.add('hidden');
      statusText.textContent = 'Not connected';
    }

    if (status?.error) {
      statusText.textContent = `Error: ${status.error}`;
      statusText.classList.add('text-red-600');
    } else {
      statusText.classList.remove('text-red-600');
    }
  };

  // Set up status callback
  googleSync.setSyncStatusCallback(updateSyncUI);

  // Initial UI update
  updateSyncUI();

  // Connect button
  connectBtn.addEventListener('click', async () => {
    audio.playClick();
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
      await googleSync.signInToGoogleDrive();
      // After connecting, sync from cloud
      await googleSync.syncFromCloud();
      audio.playSuccess();

      // Reload the page to show cloud data
      const app = document.querySelector('#app');
      if (app) {
        renderApp(app);
      }
    } catch (error) {
      console.error('Error connecting to Google Drive:', error);
      audio.playBuzz();
      connectBtn.textContent = 'Connect Google Drive';
      connectBtn.disabled = false;
      alert('Failed to connect to Google Drive. Please try again.');
    }
  });

  // Sync now button
  syncBtn.addEventListener('click', async () => {
    audio.playClick();
    const originalText = syncBtn.textContent;
    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';

    try {
      await googleSync.syncToCloud();
      audio.playSuccess();
      syncBtn.textContent = 'Synced!';
      setTimeout(() => {
        syncBtn.textContent = originalText;
        syncBtn.disabled = false;
      }, 1500);
    } catch (error) {
      console.error('Error syncing:', error);
      audio.playBuzz();
      syncBtn.textContent = originalText;
      syncBtn.disabled = false;
      alert('Failed to sync. Please try again.');
    }
  });

  // Disconnect button
  disconnectBtn.addEventListener('click', () => {
    audio.playClick();

    if (confirm('Disconnect from Google Drive? Your data will remain on this device, but will no longer sync.')) {
      googleSync.signOutFromGoogleDrive();
      audio.playSuccess();
      updateSyncUI();
    }
  });
}
