import {
  getWords,
  recordAttempt,
  moveWordToBack,
  moveWordToSecond,
  markWordDrilled,
} from "../services/storage.js";
import tts from "../services/tts.js";
import audio from "../services/audio.js";
import { Fireworks } from 'fireworks-js';
import * as googleSync from '../services/googleDriveSync.js';

/**
 * Helper function for delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper function to sync quiz data to Google Drive
 */
async function syncAfterQuiz() {
  // Only sync if signed in
  if (!googleSync.isSignedIn()) {
    return;
  }

  try {
    await googleSync.syncToCloud();
    console.log('Quiz data synced to Google Drive');
  } catch (error) {
    console.error('Error syncing after quiz:', error);
    // Don't show error to user - sync failure shouldn't interrupt their flow
  }
}

/**
 * Daily Quiz Component (Unified Learning & Testing)
 * Shows ALL words (both new and learned), teaches new words, then tests them
 */
export async function renderDailyQuiz(container, child, onComplete) {
  // Get all words for this child
  const allWords = await getWords(child.id);

  if (allWords.length === 0) {
    // No words to quiz
    container.innerHTML = `
      <div class="flex justify-center p-4">
        <div class="card max-w-2xl w-full text-center">
          <h2 class="text-3xl font-bold text-gray-800 mb-4">No Words Ready</h2>
          <p class="text-xl text-gray-600 mb-6">
            You need some words first before you can start a challenge!
          </p>
          <button id="back-btn" class="btn-primary">
            Back to Menu
          </button>
        </div>
      </div>
    `;

    container.querySelector("#back-btn").addEventListener("click", () => {
      audio.playClick();
      onComplete();
    });
    return;
  }

  // Pull the first N words from the queue for this quiz session
  const quizQueue = allWords.slice(0, child.quizLength);

  const state = {
    quizQueue: quizQueue, // Words for this quiz session
    quizLength: child.quizLength,
    completedCount: 0,
    completedWords: [], // Track completed words {word: string, firstTry: boolean}
    totalErrors: 0, // Track total errors across entire quiz
    attemptedWords: new Set(), // Track which words have been attempted (for retry detection)
  };

  render(container, child, state, onComplete);
}

async function render(container, child, state, onComplete) {
  // Check if quiz is complete first
  if (state.completedCount >= state.quizLength) {
    renderComplete(container, state, onComplete);
    return;
  }

  // Shift next word from front of queue
  const currentWord = state.quizQueue.shift();
  const progress = state.completedCount;
  const total = state.quizLength;

  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4">
      <div class="card max-w-3xl w-full p-4 sm:p-6">
        <div class="mb-4 sm:mb-6">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-lg sm:text-2xl font-bold text-primary-600 truncate flex-shrink">
              Word Master Challenge
            </h2>
            <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <span class="text-sm sm:text-lg text-gray-600 whitespace-nowrap">${progress}/${total}</span>
              <button id="exit-quiz-btn" class="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2">
                Exit
              </button>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div class="bg-primary-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                 style="width: ${(progress / total) * 100}%"></div>
          </div>
        </div>

        <div id="quiz-content" class="text-center py-6 sm:py-12">
          <!-- Content will be rendered here -->
        </div>
      </div>
    </div>
  `;

  const content = container.querySelector("#quiz-content");

  // Add exit button handler
  const exitBtn = container.querySelector("#exit-quiz-btn");
  exitBtn.addEventListener("click", () => {
    audio.playClick();
    // Clean up any keyboard listeners
    if (state.practiceState?.keyHandler) {
      document.removeEventListener("keydown", state.practiceState.keyHandler);
    }
    onComplete();
  });

  renderQuizWord(content, currentWord, child, state, container, onComplete);
}

/**
 * Render the quiz for a single word
 * If the word hasn't been drilled yet, teach it first
 */
async function renderQuizWord(
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  // Check if this word needs to be taught first
  if (!word.drilled) {
    await teachNewWord(content, word, child, state, container, onComplete);
  } else {
    await renderQuizTest(content, word, child, state, container, onComplete);
  }
}

/**
 * Teach a new word (intro → showing → spelling → practice)
 */
async function teachNewWord(
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  // Phase 1: Intro
  content.innerHTML = `
    <div class="space-y-4 sm:space-y-6">
      <h3 class="text-2xl sm:text-3xl font-bold text-gray-800">Let's learn a new word!</h3>
      <p class="text-lg sm:text-xl text-gray-600">Get ready...</p>
      <div class="animate-bounce text-5xl sm:text-6xl">📖</div>
    </div>
  `;

  // Speak the prompt (uses cached ElevenLabs audio if available)
  await tts.speakPrompt("Let's learn a new word");
  await sleep(500);

  // Phase 2: Showing - Display and speak the word
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <p class="text-xl sm:text-2xl text-gray-600">Here's your new word:</p>
      <div class="text-5xl sm:text-7xl font-bold text-primary-600 animate-bounce-in">
        ${escapeHtml(word.text)}
      </div>
      <p class="text-lg sm:text-xl text-gray-500">Listen carefully...</p>
    </div>
  `;
  await tts.speakWord(word.text, word.audioBlob);
  await sleep(1000);

  // Phase 3: Spelling - Spell out letter by letter
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
    await tts.speakLetter(letters[i]);
  }
  await sleep(1000);

  // Phase 4: Practice - Now you try!
  await renderQuizTest(content, word, child, state, container, onComplete);
}

/**
 * Render the actual quiz test (after teaching if needed)
 */
async function renderQuizTest(
  content,
  word,
  child,
  state,
  container,
  onComplete
) {
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <p class="text-xl sm:text-2xl text-gray-600">Spell the word you hear:</p>

      <div class="text-5xl sm:text-6xl">🎧</div>

      <button id="repeat-btn" class="btn-secondary text-base sm:text-lg">
        🔊 Hear it again
      </button>

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

  // Speak the word (use cached audio if available)
  // Note: We speak "Spell: [word]" but audio blob is just the word, so fall back to TTS for the phrase
  await tts.speakWord(word.text, word.audioBlob);

  // Set up practice state
  const practiceState = {
    input: "",
    targetWord: word.text.toLowerCase(),
    errorCount: 0,
  };

  // Store in state for cleanup on exit
  state.practiceState = practiceState;

  // Repeat button
  content.querySelector("#repeat-btn").addEventListener("click", async () => {
    audio.playClick();
    await tts.speakWord(word.text, word.audioBlob);
  });

  attachQuizListeners(
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
 * Attach listeners for quiz input
 */
function attachQuizListeners(
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
        if (practiceState.processing) return;
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
        if (practiceState.processing) return;
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
  if (practiceState.processing) return;

  const currentPos = practiceState.input.length;
  const expectedLetter = practiceState.targetWord[currentPos];

  if (letter === expectedLetter) {
    // Correct letter
    practiceState.processing = true;
    practiceState.input += letter;
    const box = content.querySelector(`#box-${currentPos}`);
    box.textContent = letter.toUpperCase();
    box.classList.add("filled", "correct");

    // Play click sound
    audio.playClick();
    await sleep(300);

    // Check if this is the last letter
    const isLastLetter = practiceState.input === practiceState.targetWord;

    if (isLastLetter) {
      // For last letter: wait for TTS to finish before completing word
      await tts.speakLetter(letter);

      // Clean up keyboard listener
      if (practiceState.keyHandler) {
        document.removeEventListener("keydown", practiceState.keyHandler);
      }
      await completeQuizWord(
        word,
        practiceState,
        state,
        container,
        child,
        onComplete
      );
    } else {
      // For other letters: start speaking but don't wait - allows immediate next input
      tts.speakLetter(letter).catch(err => console.error('TTS error:', err));
      practiceState.processing = false;
    }
  } else {
    // Wrong letter - show correction and restart
    practiceState.errorCount++;
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
 * Complete the current quiz word
 */
async function completeQuizWord(
  word,
  practiceState,
  state,
  container,
  child,
  onComplete
) {
  const hadErrors = practiceState.errorCount > 0;
  const isRetry = state.attemptedWords.has(word.text);

  // Mark this word as attempted
  state.attemptedWords.add(word.text);

  // Mark word as drilled if it's a new word (this happens after first successful spell)
  if (!word.drilled) {
    await markWordDrilled(word.id);
    word.drilled = true; // Update local copy
  }

  // Record the attempt in the database
  await recordAttempt(word.id, !hadErrors);

  // Update queue position based on performance
  if (hadErrors) {
    // Move to position 2 (gets another try soon)
    await moveWordToSecond(word.id);
  } else {
    // Move to back of queue (mastered!)
    await moveWordToBack(word.id);
  }

  // Play success sound
  audio.playSuccess();

  // Show feedback
  const content = container.querySelector("#quiz-content");
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <div class="text-5xl sm:text-6xl">${hadErrors ? "👍" : "🌟"}</div>
      <h3 class="text-3xl sm:text-4xl font-bold ${
        hadErrors ? "text-blue-600" : "text-green-600"
      }">
        ${hadErrors ? "Good Job!" : "Perfect!"}
      </h3>
      <p class="text-xl sm:text-2xl text-gray-700">
        ${escapeHtml(word.text.toUpperCase())}
      </p>
    </div>
  `;

  // Wait a moment
  await sleep(1500);

  // Handle word based on performance
  if (hadErrors) {
    // Swap: shift next word, unshift failed word, then unshift next word
    const nextWord = state.quizQueue.shift();
    state.quizQueue.unshift(word);
    if (nextWord) {
      state.quizQueue.unshift(nextWord);
    }
  } else {
    // Word mastered - already shifted, don't add back
    state.completedCount++;
    // Track this completed word
    state.completedWords.push({
      word: word.text,
      firstTry: !isRetry && !hadErrors // Perfect on first attempt
    });
  }

  // Track total errors for perfect quiz detection
  if (practiceState.errorCount > 0) {
    state.totalErrors = (state.totalErrors || 0) + practiceState.errorCount;
  }

  // Re-render (will either show next word or completion screen)
  render(container, child, state, onComplete);
}

/**
 * Complete phase: Quiz finished
 */
function renderComplete(container, state, onComplete) {
  const isPerfect = state.totalErrors === 0;

  if (isPerfect) {
    renderPerfectQuiz(container, state, onComplete);
  } else {
    renderRegularCompletion(container, state, onComplete);
  }
}

/**
 * Perfect quiz celebration - no errors!
 */
function renderPerfectQuiz(container, state, onComplete) {
  const wordList = state.completedWords
    .map(w => `<span class="inline-block px-3 py-2 bg-yellow-100 text-yellow-900 rounded-lg font-bold text-lg sm:text-xl m-1">${escapeHtml(w.word.toUpperCase())}</span>`)
    .join('');

  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4 bg-gradient-to-br from-yellow-50 to-orange-50 relative">
      <!-- Fireworks container (full screen) -->
      <div id="fireworks-container" class="absolute inset-0 pointer-events-none"></div>

      <div class="bg-white/50 backdrop-blur-sm rounded-2xl shadow-xl p-4 sm:p-8 border-2 border-primary-200 max-w-4xl w-full text-center relative z-10">
        <div class="space-y-4 sm:space-y-6 py-4 sm:py-8">
          <!-- Animated trophy -->
          <div class="text-6xl sm:text-8xl animate-bounce">🏆</div>

          <h2 class="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">
            PERFECT SCORE!
          </h2>

          <p class="text-2xl sm:text-3xl font-bold text-green-600">
            ${state.quizLength} word${state.quizLength === 1 ? "" : "s"} with ZERO mistakes!
          </p>

          <div class="my-6 sm:my-8">
            <p class="text-lg sm:text-xl text-gray-700 font-semibold mb-4">
              🌟 You mastered these words: 🌟
            </p>
            <div class="flex flex-wrap justify-center max-w-3xl mx-auto">
              ${wordList}
            </div>
          </div>

          <p class="text-base sm:text-lg text-gray-600 italic">
            Show this to your parent or teacher!
          </p>

          <button id="done-btn" class="btn-primary text-xl sm:text-2xl px-8 py-4 sm:px-12 sm:py-6 shadow-xl hover:scale-110 transition-transform">
            Amazing! 🎉
          </button>
        </div>
      </div>
    </div>
  `;

  // Play huge thundering applause for perfect score!
  audio.playHugeApplause();

  // Initialize fireworks
  const fireworksContainer = container.querySelector("#fireworks-container");
  const fireworks = new Fireworks(fireworksContainer, {
    acceleration: 1.05,
    friction: 0.97,
    gravity: 1.5,
    particles: 80,
    explosion: 6,
    traceLength: 3,
    traceSpeed: 10,
    flickering: 50,
    intensity: 30,
    rocketsPoint: {
      min: 50,
      max: 50
    },
    opacity: 0.5,
    boundaries: {
      x: 50,
      y: 50,
      width: fireworksContainer.clientWidth,
      height: fireworksContainer.clientHeight
    }
  });

  fireworks.start();

  container.querySelector("#done-btn").addEventListener("click", async () => {
    audio.playClick();
    audio.stop('huge-applause');
    fireworks.stop();

    // Sync to cloud if connected
    await syncAfterQuiz();

    onComplete();
  });
}

/**
 * Regular quiz completion - with some errors
 */
function renderRegularCompletion(container, state, onComplete) {
  const perfectWords = state.completedWords.filter(w => w.firstTry).length;
  const wordList = state.completedWords
    .map(w => `<span class="inline-block px-3 py-2 ${w.firstTry ? 'bg-green-100 text-green-900' : 'bg-blue-100 text-blue-900'} rounded-lg font-semibold text-base sm:text-lg m-1">${escapeHtml(w.word)}</span>`)
    .join('');

  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4">
      <div class="card max-w-4xl w-full p-4 sm:p-6 text-center">
        <div class="space-y-4 sm:space-y-6 py-6 sm:py-12">
          <div class="text-5xl sm:text-6xl animate-celebration">🎉</div>

          <h3 class="text-3xl sm:text-4xl font-bold text-green-600">
            Great Job!
          </h3>

          <div class="space-y-2">
            <p class="text-xl sm:text-2xl text-gray-700">
              You spelled ${state.quizLength} word${state.quizLength === 1 ? "" : "s"}!
            </p>
            ${perfectWords > 0 ? `
              <p class="text-lg sm:text-xl text-green-600 font-semibold">
                ${perfectWords} perfect on first try! ⭐
              </p>
            ` : ''}
          </div>

          <div class="my-4 sm:my-6">
            <p class="text-base sm:text-lg text-gray-600 mb-3">
              Words you practiced:
            </p>
            <div class="flex flex-wrap justify-center max-w-3xl mx-auto">
              ${wordList}
            </div>
            <p class="text-sm sm:text-base text-gray-500 mt-3">
              <span class="inline-block w-3 h-3 bg-green-100 rounded mr-1"></span> First try
              <span class="inline-block w-3 h-3 bg-blue-100 rounded ml-3 mr-1"></span> Needed practice
            </p>
          </div>

          <button id="done-btn" class="btn-primary text-lg sm:text-xl px-6 py-3 sm:px-8 sm:py-4">
            Done
          </button>
        </div>
      </div>
    </div>
  `;

  audio.playApplause();

  container.querySelector("#done-btn").addEventListener("click", async () => {
    audio.playClick();
    audio.stop('applause');

    // Sync to cloud if connected
    await syncAfterQuiz();

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
