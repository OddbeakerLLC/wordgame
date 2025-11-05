import {
  getUndrilledWords,
  markWordDrilled,
  getChild,
} from "../services/storage.js";
import tts from "../services/tts.js";
import audio from "../services/audio.js";

/**
 * Helper function for delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Word Drill Component
 * Teaches new words by showing, speaking, and spelling them
 */
export async function renderWordDrill(container, child, onComplete) {
  // Get undrilled words
  const words = await getUndrilledWords(child.id);

  if (words.length === 0) {
    // No words to drill
    onComplete();
    return;
  }

  const state = {
    words,
    currentIndex: 0,
    phase: "intro", // 'intro' | 'showing' | 'spelling' | 'practice' | 'complete'
  };

  render(container, child, state, onComplete);
}

async function render(container, child, state, onComplete) {
  const currentWord = state.words[state.currentIndex];
  const progress = state.currentIndex + 1;
  const total = state.words.length;

  container.innerHTML = `
    <div class="min-h-screen flex items-center justify-center p-2 sm:p-4">
      <div class="card max-w-3xl w-full p-4 sm:p-6">
        <div class="mb-4 sm:mb-6">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-lg sm:text-2xl font-bold text-primary-600 truncate flex-shrink">
              Learning New Words
            </h2>
            <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <span class="text-sm sm:text-lg text-gray-600 whitespace-nowrap">${progress}/${total}</span>
              <button id="exit-drill-btn" class="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2">
                Exit
              </button>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div class="bg-primary-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                 style="width: ${(progress / total) * 100}%"></div>
          </div>
        </div>

        <div id="drill-content" class="text-center py-6 sm:py-12">
          <!-- Content will be rendered based on phase -->
        </div>
      </div>
    </div>
  `;

  const content = container.querySelector("#drill-content");

  // Add exit button handler
  const exitBtn = container.querySelector("#exit-drill-btn");
  exitBtn.addEventListener("click", () => {
    audio.playClick();
    // Clean up any keyboard listeners
    if (state.practiceState?.keyHandler) {
      document.removeEventListener("keydown", state.practiceState.keyHandler);
    }
    onComplete();
  });

  switch (state.phase) {
    case "intro":
      renderIntro(content, currentWord, state, container, child, onComplete);
      break;
    case "showing":
      renderShowing(content, currentWord, state, container, child, onComplete);
      break;
    case "spelling":
      renderSpelling(content, currentWord, state, container, child, onComplete);
      break;
    case "practice":
      renderPractice(content, currentWord, child, state, container, onComplete);
      break;
    case "complete":
      renderComplete(content, state, onComplete);
      break;
  }
}

/**
 * Intro phase: "Let's learn a new word"
 */
function renderIntro(content, word, state, container, child, onComplete) {
  content.innerHTML = `
    <div class="space-y-4 sm:space-y-6">
      <h3 class="text-2xl sm:text-3xl font-bold text-gray-800">Let's learn a new word!</h3>
      <p class="text-lg sm:text-xl text-gray-600">Get ready...</p>
      <div class="animate-bounce text-5xl sm:text-6xl">📖</div>
    </div>
  `;

  // Auto-advance after 1.5 seconds
  setTimeout(() => {
    state.phase = "showing";
    render(container, child, state, onComplete);
  }, 1500);
}

/**
 * Showing phase: Display and speak the word
 */
async function renderShowing(
  content,
  word,
  state,
  container,
  child,
  onComplete
) {
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <p class="text-xl sm:text-2xl text-gray-600">Here's your new word:</p>
      <div class="text-5xl sm:text-7xl font-bold text-primary-600 animate-bounce-in">
        ${escapeHtml(word.text)}
      </div>
      <p class="text-lg sm:text-xl text-gray-500">Listen carefully...</p>
    </div>
  `;

  // Speak the word
  await tts.speakWord(word.text);

  // Wait a moment, then move to spelling
  setTimeout(() => {
    state.phase = "spelling";
    render(container, child, state, onComplete);
  }, 1000);
}

/**
 * Spelling phase: Spell out the word letter by letter
 */
async function renderSpelling(
  content,
  word,
  state,
  container,
  child,
  onComplete
) {
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <p class="text-xl sm:text-2xl text-gray-600">Let's spell it together:</p>
      <div class="text-4xl sm:text-6xl font-bold text-primary-600">
        ${escapeHtml(word.text)}
      </div>
      <div id="letter-display" class="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
        ${word.text
          .split("")
          .map(
            (letter, i) => `
          <div class="letter-box" id="letter-${i}">
            ${escapeHtml(letter.toUpperCase())}
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  // Spell out each letter with highlighting
  const letters = word.text.split("");
  for (let i = 0; i < letters.length; i++) {
    const letterBox = content.querySelector(`#letter-${i}`);
    letterBox.classList.add("filled");

    // Speak the letter
    await tts.speakLetter(letters[i]);

    // Pause between letters
    // await sleep(500);
  }

  // Wait a moment, then move to practice
  setTimeout(() => {
    state.phase = "practice";
    render(container, child, state, onComplete);
  }, 1000);
}

/**
 * Practice phase: Let the child type the word
 */
async function renderPractice(
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <p class="text-2xl sm:text-3xl text-gray-600">Now you try!</p>

      <div id="input-area" class="flex justify-center gap-1.5 sm:gap-2 flex-wrap">
        ${word.text
          .split("")
          .map(
            (_, i) => `
          <div class="letter-box" id="box-${i}"></div>
        `
          )
          .join("")}
      </div>

      <p class="text-base sm:text-lg text-gray-500">
        ${
          child.inputMethod === "keyboard"
            ? "Type the letters"
            : "Click or type the letters"
        }
      </p>

      ${
        child.inputMethod !== "keyboard"
          ? `
        <div id="letter-buttons" class="flex justify-center gap-1.5 sm:gap-2 flex-wrap max-w-2xl mx-auto px-2">
          <!-- Letter buttons will be added here -->
        </div>
      `
          : ""
      }
    </div>
  `;

  // Speak "Now you try! Spell: {word}"
  await tts.speak("Now you try!");
  await tts.speak(`Spell: ${word.text}`);

  // Set up practice state
  const practiceState = {
    input: "",
    targetWord: word.text.toLowerCase(),
  };

  // Store in state for cleanup on exit
  state.practiceState = practiceState;

  attachPracticeListeners(
    content,
    practiceState,
    word,
    child,
    state,
    container,
    onComplete
  );
}

/**
 * Attach listeners for practice input
 */
function attachPracticeListeners(
  content,
  practiceState,
  word,
  child,
  state,
  container,
  onComplete
) {
  // Add flag to prevent processing while handling input
  practiceState.processing = false;

  // Generate letter buttons if needed
  if (child.inputMethod !== "keyboard") {
    const letterButtons = content.querySelector("#letter-buttons");
    const letters = generateLetterPool(word.text);

    letterButtons.innerHTML = letters
      .map(
        (letter) => `
      <button class="letter-btn w-12 h-12 sm:w-14 sm:h-14 text-xl sm:text-2xl font-bold bg-white border-2 border-primary-400
                     rounded-lg hover:bg-primary-100 active:scale-95 sm:hover:scale-110 transition-all"
              data-letter="${letter}">
        ${letter.toUpperCase()}
      </button>
    `
      )
      .join("");

    // Add click handlers
    letterButtons.querySelectorAll(".letter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (practiceState.processing) return; // Prevent double-clicks
        const letter = btn.dataset.letter;
        handleLetterInput(
          letter,
          practiceState,
          content,
          word,
          child,
          state,
          container,
          onComplete
        );
      });
    });
  }

  // Keyboard input (always available in hybrid mode)
  if (child.inputMethod !== "onscreen") {
    const keyHandler = (e) => {
      if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
        e.preventDefault();
        if (practiceState.processing) return; // Prevent rapid keypresses
        handleLetterInput(
          e.key.toLowerCase(),
          practiceState,
          content,
          word,
          child,
          state,
          container,
          onComplete
        );
      }
    };

    // Store handler for cleanup
    practiceState.keyHandler = keyHandler;
    document.addEventListener("keydown", keyHandler);
  }
}

/**
 * Handle letter input (keyboard or button)
 */
async function handleLetterInput(
  letter,
  practiceState,
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  if (practiceState.processing) return; // Already processing

  const currentPos = practiceState.input.length;
  const expectedLetter = practiceState.targetWord[currentPos];

  if (letter === expectedLetter) {
    // Correct letter
    practiceState.processing = true;
    practiceState.input += letter;
    const box = content.querySelector(`#box-${currentPos}`);
    box.textContent = letter.toUpperCase();
    box.classList.add("filled", "correct");

    // Play click sound and speak the letter (don't wait for speech to finish)
    audio.playClick();
    await sleep(300);

    // Start speaking but don't await - allows immediate next input
    tts.speakLetter(letter).catch(err => console.error('TTS error:', err));

    // Check if word is complete
    if (practiceState.input === practiceState.targetWord) {
      // Clean up keyboard listener
      if (practiceState.keyHandler) {
        document.removeEventListener("keydown", practiceState.keyHandler);
      }
      await completeWord(word, state, container, child, onComplete);
    } else {
      // Allow next input immediately
      practiceState.processing = false;
    }
  } else {
    // Wrong letter - show correction and restart
    await handleError(
      letter,
      expectedLetter,
      currentPos,
      practiceState,
      content,
      word,
      child,
      state,
      container,
      onComplete
    );
  }
}

/**
 * Handle error: Show correct letter, speak it, then clear and restart
 */
async function handleError(
  wrongLetter,
  correctLetter,
  position,
  practiceState,
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  practiceState.processing = true;

  // Play buzzer
  audio.playBuzz();

  // Show the correct letter in highlighted form
  const box = content.querySelector(`#box-${position}`);
  box.textContent = correctLetter.toUpperCase();
  box.classList.add("error", "filled");

  // Speak the correct letter
  await sleep(300);
  await tts.speakLetter(correctLetter);

  // Wait 1-2 seconds
  await sleep(1500);

  // Clear all boxes
  const boxes = content.querySelectorAll('[id^="box-"]');
  boxes.forEach((b) => {
    b.textContent = "";
    b.classList.remove("filled", "correct", "error");
  });

  // Reset input
  practiceState.input = "";
  practiceState.processing = false;
}

/**
 * Complete the current word
 */
async function completeWord(word, state, container, child, onComplete) {
  // Mark as drilled
  await markWordDrilled(word.id);

  // Play success sound
  audio.playSuccess();

  // Wait a moment
  await sleep(500);

  // Move to next word or complete
  state.currentIndex++;
  if (state.currentIndex < state.words.length) {
    state.phase = "intro";
    render(container, child, state, onComplete);
  } else {
    state.phase = "complete";
    render(container, child, state, onComplete);
  }
}

/**
 * Complete phase: All words learned
 */
function renderComplete(content, state, onComplete) {
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <div class="text-5xl sm:text-6xl animate-celebration">🎉</div>
      <h3 class="text-3xl sm:text-4xl font-bold text-green-600">Amazing Work!</h3>
      <p class="text-xl sm:text-2xl text-gray-700">
        You learned ${state.words.length} new word${
    state.words.length === 1 ? "" : "s"
  }!
      </p>
      <button id="done-btn" class="btn-primary text-lg sm:text-xl px-6 py-3 sm:px-8 sm:py-4">
        Done
      </button>
    </div>
  `;

  audio.playApplause();

  content.querySelector("#done-btn").addEventListener("click", () => {
    audio.playClick();
    onComplete();
  });
}

/**
 * Generate letter pool for on-screen buttons
 */
function generateLetterPool(word) {
  const letters = word.toLowerCase().split("");
  const uniqueLetters = [...new Set(letters)];

  // Add some distractor letters (3-5 random letters not in the word)
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const distractors = [];
  const numDistractors = Math.min(5, Math.max(3, 8 - uniqueLetters.length));

  while (distractors.length < numDistractors) {
    const letter = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!uniqueLetters.includes(letter) && !distractors.includes(letter)) {
      distractors.push(letter);
    }
  }

  // Combine and shuffle
  const allLetters = [...uniqueLetters, ...distractors];
  return allLetters.sort(() => Math.random() - 0.5);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
