# CLAUDE.md - AI Assistant Context

This file provides context for AI assistants working on the Word Master Challenge project.

## Project Overview

Word Master Challenge is a Progressive Web App (PWA) for teaching children spelling through interactive drills and adaptive quizzes. Built with vanilla JavaScript, Vite, and IndexedDB.

## Architecture

### Tech Stack

- **Build Tool**: Vite (fast dev server, PWA plugin)
- **Database**: IndexedDB via Dexie.js (client-side persistence)
- **Styling**: Tailwind CSS
- **Text-to-Speech**: Web Speech API
- **Audio**: HTML5 Audio API (sound effects)
- **PWA**: vite-plugin-pwa with Workbox

### Directory Structure

```
/
├── src/
│   ├── main.js                 # Entry point, app initialization
│   ├── components/
│   │   ├── App.js             # Main app shell, routing
│   │   ├── ChildSelection.js  # Child profile picker
│   │   ├── MainMenu.js        # Drill/Quiz/Parent menu
│   │   ├── WordDrill.js       # Teaching new words (intro→showing→spelling→practice)
│   │   ├── DailyQuiz.js       # Quiz mode with spaced repetition
│   │   └── ParentTeacher.js   # Word/child management interface
│   ├── services/
│   │   ├── storage.js         # IndexedDB operations (Dexie)
│   │   ├── tts.js            # Text-to-speech wrapper
│   │   └── audio.js          # Sound effects (click, buzz, success, applause)
│   └── styles.css            # Tailwind imports + custom styles
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                # Service worker (auto-generated)
│   ├── icon-*.png           # App icons (192x192, 512x512)
│   └── sounds/              # Audio files (.mp3)
├── tools/
│   └── generate-icons.html  # Browser-based icon generator
├── docs/
│   └── PWA.md              # PWA implementation guide
└── vite.config.js          # Vite + PWA plugin config
```

## Core Concepts

### 1. Child Profiles

- Stored in `children` table (IndexedDB)
- Fields: `id`, `name`, `inputMethod` (keyboard/onscreen/hybrid), `quizLength`
- Each child has independent word queues

### 2. Word Queue System

- Stored in `words` table with `childId`, `text`, `position`, `drilled`, `attempts`, `successes`
- **Position-based queue**: Lower position = earlier in queue (0 is front)
- **Drilled flag**: Words start undrilled, marked drilled after completing Word Drill
- **Quiz eligibility**: Only drilled words appear in quizzes

### 3. Word Drill Mode (`WordDrill.js`)

**Purpose**: Teach new (undrilled) words through multi-phase learning

**Phases**:

1. **Intro**: "Let's learn a new word!" (1.5s auto-advance)
2. **Showing**: Display word + speak it (1s delay)
3. **Spelling**: Show letters, speak each one by one
4. **Practice**: Child spells the word
   - Correct letter: Highlight green, speak letter, advance
   - Wrong letter: Show correct letter in red, speak it, wait 1.5s, clear and restart
5. **Complete**: Mark word as drilled, move to next or finish

**Key Features**:

- Adaptive input: Generates letter buttons (correct letters + 3-5 distractors) for on-screen mode
- Error handling: Shows correct letter, speaks it, then clears all boxes
- Keyboard listener cleanup on exit (important!)

### 4. Daily Quiz Mode (`DailyQuiz.js`)

**Purpose**: Test drilled words with spaced repetition

**Queue Logic** (IMPORTANT - uses simple array operations):

```javascript
// 1. Load N words from database into quizQueue (snapshot)
const quizQueue = drilledWords.slice(0, child.quizLength);

// 2. Present word: shift() from front
const currentWord = state.quizQueue.shift();

// 3. After spelling:
if (hadErrors) {
  // Swap with next word (immediate retry)
  const nextWord = state.quizQueue.shift();
  state.quizQueue.unshift(word); // Put failed word back
  if (nextWord) {
    state.quizQueue.unshift(nextWord); // Put next word in front
  }
} else {
  // Success: Already shifted, just increment counter
  state.completedCount++;
}
```

**Database Updates** (for future quiz sessions):

- Success (no errors): `moveWordToBack()` - mastered!
- Failure (any errors): `moveWordToSecond()` - gets another try soon

**Error Tracking**:

- `practiceState.errorCount` increments on each wrong letter
- Tracked per word (resets for each new word)
- If `errorCount > 0` when word completes, it's considered a failure

### 5. Storage Service (`storage.js`)

**Key Functions**:

```javascript
// Children
getChildren();
getChild(id);
addChild({ name, inputMethod, quizLength });
updateChild(id, updates);
deleteChild(id);

// Words
getWords(childId); // All words for child
getUndrilledWords(childId); // For Word Drill
addWord(childId, text); // Adds at back of queue
deleteWord(id);
markWordDrilled(id); // Sets drilled=true

// Queue Management
moveWordToBack(id); // Success in quiz
moveWordToSecond(id); // Failure in quiz
recordAttempt(id, success); // Track stats

// Import/Export
importWords(childId, texts); // Bulk add words
exportWords(childId); // Get all word texts
```

**Queue Position Logic**:

- `moveWordToBack()`: Shifts all words between current and max position down, moves word to max
- `moveWordToSecond()`: Shifts words between position 1 and current position up, moves word to position 1
- Position 0 is front, highest position is back

### 6. Text-to-Speech (`tts.js`)

**Methods**:

```javascript
tts.speak(text); // Generic speech
tts.speakWord(word); // Emphasize word
tts.speakLetter(letter); // Spell out letter
```

**Implementation**: Web Speech API (`speechSynthesis`)

- Rate: 0.9 (slightly slower for clarity)
- Pitch: 1.0 (normal)
- Works offline (device TTS engine)

### 7. Audio Service (`audio.js`)

**Sound Effects**:

- `playClick()` - Button clicks
- `playBuzz()` - Wrong answer
- `playSuccess()` - Correct word completion
- `playApplause()` - Drill/quiz completion

**Implementation**: Preloaded HTML5 Audio objects

### 8. PWA Features

**Configuration** ([vite.config.js](vite.config.js)):

- Service worker auto-generates with Workbox
- Caches all assets: JS, CSS, HTML, sounds, icons
- Runtime caching for Google Fonts
- `devOptions.enabled = true` for local testing

**Files**:

- [public/manifest.json](public/manifest.json) - App metadata
- [public/icon-192.png](public/icon-192.png), [public/icon-512.png](public/icon-512.png) - Icons
- [public/sw.js](public/sw.js) - Auto-generated service worker

**Offline Support**: Everything works offline after first load (IndexedDB + cached assets)

## Common Patterns

### Component Structure

All components follow this pattern:

```javascript
export async function renderComponentName(container, ...params, onComplete) {
  // 1. Fetch data from storage
  // 2. Build state object
  // 3. Render UI
  // 4. Attach event listeners
  // 5. Call onComplete() when done
}
```

### Async/Await Sleep

```javascript
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(1500); // Pause for user feedback
```

### Keyboard Listener Cleanup

Always clean up keyboard listeners to prevent memory leaks:

```javascript
const keyHandler = (e) => {
  /* handle key */
};
state.keyHandler = keyHandler; // Store for cleanup
document.addEventListener("keydown", keyHandler);

// Later (on completion or exit):
if (state.keyHandler) {
  document.removeEventListener("keydown", state.keyHandler);
}
```

### HTML Escaping

Always escape user input:

```javascript
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
```

### Processing Flag Pattern

Prevent double-clicks/rapid keypresses:

```javascript
practiceState.processing = false; // Init

async function handleInput() {
  if (practiceState.processing) return; // Guard
  practiceState.processing = true;

  // Do async work...

  practiceState.processing = false; // Reset when safe
}
```

## Important Implementation Notes

### Quiz Queue Logic

- **DO NOT** reload words from database during quiz
- **DO** use simple JavaScript array operations (`shift`, `unshift`, `push`)
- **DO** work with a snapshot of N words pulled at quiz start
- The quiz queue is in-memory; database queue updates happen in parallel for future sessions

### Input Method Handling

Three modes:

1. **keyboard**: Physical keyboard only (no on-screen buttons)
2. **onscreen**: On-screen letter buttons only (no keyboard listener)
3. **hybrid**: Both keyboard and on-screen buttons work

### Error Handling in Quiz vs Drill

- **Drill**: Errors just restart the word (no tracking, no consequences)
- **Quiz**: Errors are tracked (`errorCount`), affect queue position, recorded in stats

### Position vs Index

- **Position**: Database field for queue ordering (0 = front, higher = further back)
- **Index**: Array index in JavaScript (0-based)
- Don't confuse them! Database positions can have gaps; array indices are sequential.

## Development Commands

```bash
npm install              # Install dependencies
npm run dev             # Dev server (http://localhost:3000)
npm run build           # Production build
npm run preview         # Preview production build
```

## Testing the App

1. **Create a child profile** with desired input method
2. **Add words** via Parent/Teacher interface
3. **Word Drill**: Teaches undrilled words (marks them drilled)
4. **Daily Quiz**: Tests drilled words with spaced repetition
5. **Check DevTools** > Application > IndexedDB to see data
6. **Check DevTools** > Application > Service Workers for PWA status

## Common Gotchas

1. **Quiz not showing words**: Make sure words are marked `drilled=true` first
2. **Words not re-appearing after errors**: Check console logs for queue state
3. **Double input**: Always use `processing` flag to prevent rapid input
4. **Memory leaks**: Always clean up keyboard listeners on exit/completion
5. **PWA not installing**: Check that icons exist and service worker registered
6. **Audio not playing**: Check browser autoplay policies (user interaction required)

## Future Enhancements (TODO)

- 3D visual effects with three.js (celebration animations)
- Cloud sync (Firebase/Supabase for multi-device support)
- Push notifications for daily quiz reminders
- Word import from CSV files
- Progress reports and statistics dashboard
- Multiple quiz modes (timed, themed, etc.)

## Code Style

- Use `async/await` (not `.then()` chains)
- Use arrow functions for consistency
- Use template literals for HTML generation
- Use `const` by default, `let` when reassignment needed
- Comment complex logic, especially queue manipulations
- Keep functions small and focused
- Use descriptive variable names

## Key Insights for AI Assistants

1. **Queue operations should be simple**: Don't overthink array manipulations. Use built-in methods.
2. **Separation of concerns**: In-memory quiz queue vs persistent database queue serve different purposes
3. **User feedback is critical**: Sound effects, visual feedback, and TTS make or break the UX
4. **Cleanup matters**: Event listeners must be removed to prevent bugs
5. **Offline-first**: IndexedDB + PWA caching = fully functional offline app
6. **Child-friendly**: Large buttons, clear feedback, forgiving error handling

## Questions or Issues?

- Check console logs (extensive logging in DailyQuiz.js and storage.js)
- Review [docs/PWA.md](docs/PWA.md) for PWA troubleshooting
- Check [README.md](README.md) for user-facing documentation
- IndexedDB can be inspected in Chrome DevTools > Application > Storage

---

Last updated: 2025-11-05
Project status: Core features complete, PWA functional, ready for enhancements
