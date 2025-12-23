import { getChildren } from '../services/storage.js';
import { renderChildSelection } from './ChildSelection.js';
import { renderMainMenu } from './MainMenu.js';
import { renderParentTeacher } from './ParentTeacher.js';
import { renderDailyQuiz } from './DailyQuiz.js';
import { renderAbout } from './About.js';
import * as googleSync from '../services/googleDriveSync.js';

/**
 * Application State
 */
const state = {
  currentChild: null,
  currentView: 'child-selection', // 'child-selection' | 'main-menu' | 'quiz' | 'parent' | 'about'
  lastSelectedChildId: null // Store child ID separately for Parent/Teacher interface
};

/**
 * Main App Component
 */
export async function renderApp(container) {
  // Trigger background sync if signed in (quietly, don't block UI)
  triggerBackgroundSync();

  // Check if we have any children
  const children = await getChildren();

  if (children.length === 0 || !state.currentChild) {
    state.currentView = 'child-selection';
  }

  render(container);
}

/**
 * Trigger background sync on app launch (non-blocking)
 */
async function triggerBackgroundSync() {
  try {
    // Initialize Google services first
    const initialized = await googleSync.autoInit();
    console.log('[App] Google sync initialized:', initialized, 'Signed in:', googleSync.isSignedIn());

    if (initialized && googleSync.isSignedIn()) {
      console.log('[App] Starting background sync from cloud...');
      // Fire and forget - don't await, don't block UI
      googleSync.syncFromCloud()
        .then((result) => {
          console.log('[App] Background sync completed:', result);
          // If we're on a screen that shows data, we might want to refresh
          // For now, just log - the next navigation will show updated data
        })
        .catch(err => {
          // Token might be expired, just log the error
          console.log('[App] Background sync failed (this is OK if token expired):', err.message);
        });
    }
  } catch (error) {
    console.error('[App] Error initializing background sync:', error);
  }
}

/**
 * Render current view
 */
function render(container) {
  container.innerHTML = `
    <div class="w-full p-4">
      <!-- Logo header -->
      <div class="text-center mb-6">
        <img src="${import.meta.env.BASE_URL}LogoLetterhead.png"
             alt="Oddbeaker LLC"
             class="mx-auto mb-2"
             style="height: 100px; width: auto;">
        <h1 class="text-3xl md:text-4xl font-bold text-primary-600">
          Word Master Challenge
        </h1>
      </div>

      <!-- Main content area -->
      <div id="main-content"></div>
    </div>
  `;

  const mainContent = container.querySelector('#main-content');

  switch (state.currentView) {
    case 'child-selection':
      renderChildSelection(
        mainContent,
        onChildSelected,
        () => switchView('parent'),
        () => switchView('about')
      );
      break;
    case 'main-menu':
      renderMainMenu(mainContent, state.currentChild, {
        onDailyQuiz: () => switchView('quiz'),
        onChangeChild: () => {
          switchView('child-selection');
        },
        onAbout: () => switchView('about')
      });
      break;
    case 'quiz':
      renderDailyQuiz(mainContent, state.currentChild, () => switchView('main-menu'));
      break;
    case 'parent':
      renderParentTeacher(
        mainContent,
        () => {
          // Go back to main menu if child is selected, otherwise go to child selection
          if (state.currentChild) {
            switchView('main-menu');
          } else {
            switchView('child-selection');
          }
        },
        state.lastSelectedChildId
      );
      break;
    case 'about':
      renderAbout(mainContent, () => {
        // Go back to main menu if child is selected, otherwise go to child selection
        if (state.currentChild) {
          switchView('main-menu');
        } else {
          switchView('child-selection');
        }
      });
      break;
  }
}

/**
 * Event Handlers
 */
async function onChildSelected(child) {
  state.currentChild = child;
  state.lastSelectedChildId = child.id; // Store ID separately

  // Note: We no longer sort the word queue here because:
  // 1. The quiz manages positions via moveWordToBack/moveWordToSecond (spaced repetition)
  // 2. Sorting on every selection was undoing quiz progress

  switchView('main-menu');
}

function switchView(view) {
  state.currentView = view;
  const app = document.getElementById('app');
  render(app);
}

// Export state for other components
export { state, switchView };
