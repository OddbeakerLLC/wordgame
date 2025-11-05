import { getChildren } from '../services/storage.js';
import { renderChildSelection } from './ChildSelection.js';
import { renderMainMenu } from './MainMenu.js';
import { renderParentTeacher } from './ParentTeacher.js';
import { renderWordDrill } from './WordDrill.js';
import { renderDailyQuiz } from './DailyQuiz.js';

/**
 * Application State
 */
const state = {
  currentChild: null,
  currentView: 'child-selection' // 'child-selection' | 'main-menu' | 'drill' | 'quiz' | 'parent'
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
  container.innerHTML = '';

  switch (state.currentView) {
    case 'child-selection':
      renderChildSelection(container, onChildSelected);
      break;
    case 'main-menu':
      renderMainMenu(container, state.currentChild, {
        onDailyQuiz: () => switchView('quiz'),
        onDrill: () => switchView('drill'),
        onParent: () => switchView('parent'),
        onChangeChild: () => {
          state.currentChild = null;
          switchView('child-selection');
        }
      });
      break;
    case 'drill':
      renderWordDrill(container, state.currentChild, () => switchView('main-menu'));
      break;
    case 'quiz':
      renderDailyQuiz(container, state.currentChild, () => switchView('main-menu'));
      break;
    case 'parent':
      renderParentTeacher(container, () => switchView('main-menu'));
      break;
  }
}

/**
 * Event Handlers
 */
function onChildSelected(child) {
  state.currentChild = child;
  switchView('main-menu');
}

function switchView(view) {
  state.currentView = view;
  const app = document.getElementById('app');
  render(app);
}

// Export state for other components
export { state, switchView };
