import { getChildren, sortWordQueue } from '../services/storage.js';
import { renderChildSelection } from './ChildSelection.js';
import { renderMainMenu } from './MainMenu.js';
import { renderParentTeacher } from './ParentTeacher.js';
import { renderDailyQuiz } from './DailyQuiz.js';
import { renderAbout } from './About.js';

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
  // Check if we have any children
  const children = await getChildren();

  if (children.length === 0 || !state.currentChild) {
    state.currentView = 'child-selection';
  }

  render(container);
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

  // Sort the word queue on first selection
  // This prioritizes words with high error rates and shorter words
  await sortWordQueue(child.id);

  switchView('main-menu');
}

function switchView(view) {
  state.currentView = view;
  const app = document.getElementById('app');
  render(app);
}

// Export state for other components
export { state, switchView };
