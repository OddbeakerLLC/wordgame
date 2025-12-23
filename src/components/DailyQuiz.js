import {
  getWords,
  recordAttempt,
  recordSightRead,
  moveWordToBack,
  moveWordToSecond,
  moveWordToPosition,
  markWordDrilled,
} from "../services/storage.js";
import tts from "../services/tts.js";
import audio from "../services/audio.js";
import { Fireworks } from 'fireworks-js';
import * as googleSync from '../services/googleDriveSync.js';
import { backfillWordAudio } from '../services/audioLoader.js';

/**
 * Helper function for delays
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper function to sync child data TO cloud after quiz
 */
async function syncChildAfterQuiz(childId) {
  // Only sync if signed in
  if (!googleSync.isSignedIn()) {
    return;
  }

  try {
    await googleSync.syncChildToCloud(childId);
    console.log('Child quiz data synced to Google Drive');
  } catch (error) {
    console.error('Error syncing child after quiz:', error);
    // Don't show error to user - sync failure shouldn't interrupt their flow
  }
}

/**
 * Helper function to sync child data FROM cloud before quiz
 */
async function syncChildBeforeQuiz(childId) {
  // Only sync if signed in
  if (!googleSync.isSignedIn()) {
    return;
  }

  try {
    await googleSync.syncChildFromCloud(childId);
    console.log('Child data synced from Google Drive before quiz');
  } catch (error) {
    console.error('Error syncing child before quiz:', error);
    // Don't show error to user - sync failure shouldn't interrupt their flow
  }
}

/**
 * Daily Quiz Component (Unified Learning & Testing)
 * Shows ALL words (both new and learned), teaches new words, then tests them
 */
export async function renderDailyQuiz(container, child, onComplete) {
  // Pull this child's data from cloud before starting (silent, non-blocking UI)
  await syncChildBeforeQuiz(child.id);

  // Get all words for this child (now includes any updates from cloud)
  let allWords = await getWords(child.id);

  // Backfill audio for words that don't have audioBlob
  // This ensures we use ElevenLabs audio from common-words-audio.json
  // or generates it on-demand for custom words
  allWords = await backfillWordAudio(allWords);

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
  let quizQueue = allWords.slice(0, child.quizLength);

  // Separate homophones to avoid confusion (e.g., "there"/"their", "to"/"two", "know"/"no")
  quizQueue = separateHomophones(quizQueue);

  const state = {
    childId: child.id, // Store child ID for sync
    quizQueue: quizQueue, // Words for this quiz session
    quizLength: child.quizLength,
    completedCount: 0,
    completedWords: [], // Track completed words {word: string, firstTry: boolean, id: number, audioBlob: Blob}
    totalErrors: 0, // Track total errors across entire quiz
    missedWords: new Set(), // Track word IDs that have been missed during this quiz session
    // Reading phase state
    phase: 'spelling', // 'spelling' | 'reading' | 'complete'
    readingQueue: [], // Words for reading phase (populated after spelling)
    readingIndex: 0,
    readingResults: [], // { word, recognized: boolean }
    missedReading: new Set(), // Track words that were missed at least once during reading
  };

  render(container, child, state, onComplete);
}

async function render(container, child, state, onComplete) {
  // Check if spelling phase is complete - transition to reading
  if (state.completedCount >= state.quizLength) {
    renderComplete(container, state, child, onComplete);
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
    // Set exit flag to stop any async operations
    state.exiting = true;
    // Stop any ongoing TTS
    tts.stop();
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
  if (state.exiting) return;
  await sleep(500);
  if (state.exiting) return;

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
  if (state.exiting) return;
  await sleep(1000);
  if (state.exiting) return;

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
    if (state.exiting) return;
    const letterBox = content.querySelector(`#letter-${i}`);
    letterBox.classList.add("filled");
    await tts.speakLetter(letters[i]);
  }
  if (state.exiting) return;
  await sleep(1000);
  if (state.exiting) return;

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

  // Speak "Spell {word}"
  await tts.speakPrompt("Spell");
  if (state.exiting) return;
  await sleep(300); // Small pause between "Spell" and the word
  if (state.exiting) return;
  await tts.speakWord(word.text, word.audioBlob);
  if (state.exiting) return;

  // Set up practice state
  const practiceState = {
    input: "",
    targetWord: word.text.toLowerCase(),
    errorCount: 0,
  };

  // Store in state for cleanup on exit
  state.practiceState = practiceState;

  // Repeat button - disable while speaking to prevent spam clicks
  const repeatBtn = content.querySelector("#repeat-btn");
  repeatBtn.addEventListener("click", async () => {
    if (repeatBtn.disabled || state.exiting) return;
    repeatBtn.disabled = true;
    repeatBtn.classList.add("opacity-50", "cursor-not-allowed");

    audio.playClick();
    await tts.speakPrompt("Spell");
    if (state.exiting) return;
    await sleep(300);
    if (state.exiting) return;
    await tts.speakWord(word.text, word.audioBlob);
    if (state.exiting) return;

    repeatBtn.disabled = false;
    repeatBtn.classList.remove("opacity-50", "cursor-not-allowed");
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

    // Scroll to make letter buttons visible on mobile
    letterButtons.scrollIntoView({ behavior: "smooth", block: "end" });
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
  const wasPreviouslyMissed = state.missedWords.has(word.id);

  // Mark word as drilled if it's a new word (this happens after first successful spell)
  if (!word.drilled) {
    await markWordDrilled(word.id);
    word.drilled = true; // Update local copy
  }

  // Record the attempt in the database
  await recordAttempt(word.id, !hadErrors);

  // Track errors for this session (queue position updates deferred until full session completes)
  if (hadErrors) {
    state.missedWords.add(word.id);
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
      id: word.id,
      word: word.text,
      firstTry: !wasPreviouslyMissed, // Perfect on first attempt (never missed this session)
      audioBlob: word.audioBlob // Store audio for playback at end
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
 * Spelling phase complete - transition to reading phase
 */
async function renderComplete(container, state, child, onComplete) {
  // Transition to reading phase
  state.phase = 'reading';

  // Prepare reading queue from completed words
  // For 6 words or fewer, keep same order; otherwise shuffle
  state.readingQueue = [...state.completedWords];
  if (state.readingQueue.length > 6) {
    state.readingQueue.sort(() => Math.random() - 0.5);
  }
  state.readingIndex = 0;
  state.readingResults = [];

  // Show transition screen
  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4">
      <div class="card max-w-3xl w-full p-4 sm:p-6 text-center">
        <div class="space-y-6 sm:space-y-8 py-8 sm:py-12">
          <div class="text-5xl sm:text-6xl animate-bounce">📚</div>
          <h3 class="text-3xl sm:text-4xl font-bold text-primary-600">
            Great spelling!
          </h3>
          <p class="text-xl sm:text-2xl text-gray-600">
            Now let's read!
          </p>
        </div>
      </div>
    </div>
  `;

  // Speak the transition
  await tts.speakPrompt("Great spelling");
  if (state.exiting) return;
  await sleep(500);
  if (state.exiting) return;
  await tts.speakPrompt("Now let's read");
  if (state.exiting) return;
  await sleep(1000);
  if (state.exiting) return;

  // Start reading phase
  renderReadingCard(container, state, child, onComplete);
}

/**
 * Render a reading flashcard
 */
async function renderReadingCard(container, state, child, onComplete) {
  // Check if reading phase is complete
  if (state.readingIndex >= state.readingQueue.length) {
    renderFinalCompletion(container, state, onComplete);
    return;
  }

  const currentWord = state.readingQueue[state.readingIndex];
  const progress = state.readingIndex;
  const total = state.readingQueue.length;

  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4">
      <div class="card max-w-3xl w-full p-4 sm:p-6">
        <div class="mb-4 sm:mb-6">
          <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-lg sm:text-2xl font-bold text-primary-600 truncate flex-shrink">
              Reading Time
            </h2>
            <div class="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <span class="text-sm sm:text-lg text-gray-600 whitespace-nowrap">${progress}/${total}</span>
              <button id="exit-reading-btn" class="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2">
                Exit
              </button>
            </div>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 sm:h-3">
            <div class="bg-primary-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                 style="width: ${(progress / total) * 100}%"></div>
          </div>
        </div>

        <div id="reading-content" class="text-center py-6 sm:py-8">
          <div class="space-y-6 sm:space-y-8">
            <div class="flashcard mx-auto max-w-md">
              <span class="flashcard-word">${escapeHtml(currentWord.word)}</span>
            </div>

            <button id="hear-answer-btn" class="btn-primary text-base sm:text-lg">
              🔊 Hear the answer
            </button>

            <div id="assessment-buttons" class="hidden space-y-4">
              <button id="hear-again-btn" class="btn-secondary text-base sm:text-lg">
                🔊 Hear it again
              </button>
              <div class="flex justify-center gap-4">
                <button id="got-it-btn" class="btn-got-it text-3xl sm:text-4xl px-6 py-3" title="I got it!">
                  👍😊
                </button>
                <button id="practice-more-btn" class="btn-practice-more text-3xl sm:text-4xl px-6 py-3" title="I'll practice more">
                  👎😐
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Exit button handler
  container.querySelector("#exit-reading-btn").addEventListener("click", () => {
    audio.playClick();
    // Set exit flag to stop any async operations
    state.exiting = true;
    // Stop any ongoing TTS
    tts.stop();
    onComplete();
  });

  // Speak the instruction for first card or "Here is the next word" for subsequent cards
  if (state.readingIndex === 0) {
    await tts.speakPrompt("Read this word out loud then check your answer");
  } else {
    await tts.speakPrompt("Here is the next word");
  }
  if (state.exiting) return;

  // "Hear the answer" button - reveals assessment options
  const hearAnswerBtn = container.querySelector("#hear-answer-btn");
  const assessmentButtons = container.querySelector("#assessment-buttons");

  hearAnswerBtn.addEventListener("click", async () => {
    if (hearAnswerBtn.disabled || state.exiting) return;
    hearAnswerBtn.disabled = true;
    hearAnswerBtn.classList.add("opacity-50", "cursor-not-allowed");

    audio.playClick();
    await tts.speakWord(currentWord.word, currentWord.audioBlob);
    if (state.exiting) return;

    // Hide "hear answer" button, show assessment buttons
    hearAnswerBtn.classList.add("hidden");
    assessmentButtons.classList.remove("hidden");

    // Scroll to make assessment buttons visible on mobile
    assessmentButtons.scrollIntoView({ behavior: "smooth", block: "end" });

    // Ask "Did you get it?"
    await tts.speakPrompt("Did you get it?");
  });

  // "Hear it again" button
  const hearAgainBtn = container.querySelector("#hear-again-btn");
  hearAgainBtn.addEventListener("click", async () => {
    if (hearAgainBtn.disabled || state.exiting) return;
    hearAgainBtn.disabled = true;
    hearAgainBtn.classList.add("opacity-50", "cursor-not-allowed");

    audio.playClick();
    await tts.speakWord(currentWord.word, currentWord.audioBlob);
    if (state.exiting) return;

    hearAgainBtn.disabled = false;
    hearAgainBtn.classList.remove("opacity-50", "cursor-not-allowed");
  });

  // "I got it!" button
  container.querySelector("#got-it-btn").addEventListener("click", async () => {
    audio.playClick();
    audio.playSuccess();
    await handleReadingResponse(true, currentWord, state, container, child, onComplete);
  });

  // "I'll practice more" button
  container.querySelector("#practice-more-btn").addEventListener("click", async () => {
    audio.playClick();
    await handleReadingResponse(false, currentWord, state, container, child, onComplete);
  });
}

/**
 * Handle reading self-assessment response
 */
async function handleReadingResponse(recognized, currentWord, state, container, child, onComplete) {
  // Record the sight-read attempt
  await recordSightRead(currentWord.id, recognized);

  // Brief feedback
  const content = container.querySelector("#reading-content");
  content.innerHTML = `
    <div class="space-y-6 sm:space-y-8">
      <div class="text-5xl sm:text-6xl">${recognized ? "🌟" : "👍"}</div>
      <h3 class="text-3xl sm:text-4xl font-bold ${recognized ? "text-green-600" : "text-blue-600"}">
        ${recognized ? "Awesome!" : "Keep practicing!"}
      </h3>
      <p class="text-xl sm:text-2xl text-gray-700">
        ${escapeHtml(currentWord.word.toUpperCase())}
      </p>
    </div>
  `;

  await sleep(1200);

  if (recognized) {
    // Success: track result and move to next
    state.readingResults.push({
      word: currentWord.word,
      recognized: true
    });
    state.readingIndex++;
  } else {
    // Failed: track that this word was missed
    state.missedReading.add(currentWord.word);

    // Reinsert word 2 positions later (like spelling quiz)
    const currentIdx = state.readingIndex;
    const insertIdx = Math.min(currentIdx + 2, state.readingQueue.length);

    // Insert the failed word back into queue
    state.readingQueue.splice(insertIdx, 0, currentWord);

    // Move index forward (we'll see the next word, then this one again)
    state.readingIndex++;
  }

  // Next card or completion
  renderReadingCard(container, state, child, onComplete);
}

/**
 * Finalize queue positions after full session (spelling + reading) completes
 * This is called only when the child finishes both phases
 */
async function finalizeQueuePositions(state) {
  for (const completedWord of state.completedWords) {
    const wasMissedSpelling = state.missedWords.has(completedWord.id);
    const wasMissedReading = state.missedReading.has(completedWord.word);

    if (wasMissedSpelling || wasMissedReading) {
      // Had trouble with spelling OR reading: move to position N (quiz length)
      // Keep in rotation for more practice
      await moveWordToPosition(completedWord.id, state.quizLength);
    } else if (!completedWord.firstTry) {
      // Correct on 2nd+ spelling attempt but got reading right
      await moveWordToPosition(completedWord.id, state.quizLength);
    } else {
      // Perfect on both spelling (first try) AND reading: move to back (mastered!)
      await moveWordToBack(completedWord.id);
    }
  }
}

/**
 * Final completion screen - shows both spelling and reading results
 */
function renderFinalCompletion(container, state, onComplete) {
  const perfectSpelling = state.totalErrors === 0;
  const perfectReading = state.missedReading.size === 0;

  if (perfectSpelling && perfectReading) {
    renderPerfectSession(container, state, onComplete);
  } else {
    renderRegularCompletion(container, state, onComplete);
  }
}

/**
 * Perfect session celebration - no spelling errors AND all words recognized!
 */
function renderPerfectSession(container, state, onComplete) {
  const wordList = state.completedWords
    .map(w => `<button class="word-button inline-block px-3 py-2 bg-yellow-100 text-yellow-900 rounded-lg font-bold text-lg sm:text-xl m-1 hover:bg-yellow-200 active:scale-95 transition-all cursor-pointer" data-word="${escapeHtml(w.word)}">${escapeHtml(w.word.toUpperCase())}</button>`)
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
            PERFECT!
          </h2>

          <div class="space-y-2">
            <p class="text-2xl sm:text-3xl font-bold text-green-600">
              Spelling AND Reading!
            </p>
            <p class="text-lg sm:text-xl text-gray-600">
              ${state.quizLength} words with zero mistakes!
            </p>
          </div>

          <div class="my-6 sm:my-8">
            <p class="text-lg sm:text-xl text-gray-700 font-semibold mb-4">
              🌟 You mastered these words: 🌟
            </p>
            <div id="word-list" class="flex flex-wrap justify-center max-w-3xl mx-auto">
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

  // Add click handlers to word buttons
  const wordButtons = container.querySelectorAll('.word-button');
  wordButtons.forEach((btn, index) => {
    btn.addEventListener('click', async () => {
      audio.playClick();
      const word = btn.dataset.word;
      const audioBlob = state.completedWords[index]?.audioBlob;
      await tts.speakWord(word, audioBlob);
    });
  });

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

  // Store child.id for use in the event listener
  const childId = state.childId;

  container.querySelector("#done-btn").addEventListener("click", async () => {
    audio.playClick();
    audio.stop('huge-applause');
    fireworks.stop();

    // Finalize queue positions now that full session is complete
    await finalizeQueuePositions(state);

    // Sync this child's data to cloud
    await syncChildAfterQuiz(childId);

    onComplete();
  });
}

/**
 * Regular session completion - with some errors in spelling or reading
 */
function renderRegularCompletion(container, state, onComplete) {
  const perfectSpelling = state.completedWords.filter(w => w.firstTry).length;
  const recognizedCount = state.readingResults.filter(r => r.recognized).length;

  // Build word list with emoji indicators for spelling and reading
  const wordList = state.completedWords
    .map(w => {
      const missedSpelling = state.missedWords.has(w.id);
      const missedReading = state.missedReading.has(w.word);
      const spellingIcon = missedSpelling ? '✏️✗' : '✏️✓';
      const readingIcon = missedReading ? '👁️✗' : '👁️✓';

      // Color based on overall performance (green if both perfect, blue if any missed)
      const isPerfect = !missedSpelling && !missedReading && w.firstTry;
      const bgClass = isPerfect ? 'bg-green-100 text-green-900 hover:bg-green-200' : 'bg-blue-100 text-blue-900 hover:bg-blue-200';

      return `<button class="word-button inline-block px-3 py-2 ${bgClass} rounded-lg font-semibold text-base sm:text-lg m-1 active:scale-95 transition-all cursor-pointer" data-word="${escapeHtml(w.word)}">
        ${escapeHtml(w.word)} <span class="text-xs sm:text-sm">${spellingIcon} ${readingIcon}</span>
      </button>`;
    })
    .join('');

  container.innerHTML = `
    <div class="flex justify-center p-2 sm:p-4">
      <div class="card max-w-4xl w-full p-4 sm:p-6 text-center">
        <div class="space-y-4 sm:space-y-6 py-6 sm:py-12">
          <div class="text-5xl sm:text-6xl animate-celebration">🎉</div>

          <h3 class="text-3xl sm:text-4xl font-bold text-green-600">
            Great Job!
          </h3>

          <div class="space-y-3">
            <p class="text-xl sm:text-2xl text-gray-700">
              You practiced ${state.quizLength} word${state.quizLength === 1 ? "" : "s"}!
            </p>
            <div class="flex justify-center gap-6 sm:gap-8 text-base sm:text-lg">
              <div class="text-center">
                <p class="font-bold text-primary-600">Spelling</p>
                <p class="text-gray-600">${perfectSpelling}/${state.quizLength} perfect</p>
              </div>
              <div class="text-center">
                <p class="font-bold text-primary-600">Reading</p>
                <p class="text-gray-600">${recognizedCount}/${state.readingResults.length} recognized</p>
              </div>
            </div>
          </div>

          <div class="my-4 sm:my-6">
            <p class="text-base sm:text-lg text-gray-600 mb-3">
              Words you practiced:
            </p>
            <div id="word-list" class="flex flex-wrap justify-center max-w-3xl mx-auto">
              ${wordList}
            </div>
          </div>

          <button id="done-btn" class="btn-primary text-lg sm:text-xl px-6 py-3 sm:px-8 sm:py-4">
            Done
          </button>
        </div>
      </div>
    </div>
  `;

  audio.playApplause();

  // Add click handlers to word buttons
  const wordButtons = container.querySelectorAll('.word-button');
  wordButtons.forEach((btn, index) => {
    btn.addEventListener('click', async () => {
      audio.playClick();
      const word = btn.dataset.word;
      const audioBlob = state.completedWords[index]?.audioBlob;
      await tts.speakWord(word, audioBlob);
    });
  });

  // Store child.id for use in the event listener
  const childId = state.childId;

  container.querySelector("#done-btn").addEventListener("click", async () => {
    audio.playClick();
    audio.stop('applause');

    // Finalize queue positions now that full session is complete
    await finalizeQueuePositions(state);

    // Sync this child's data to cloud
    await syncChildAfterQuiz(childId);

    onComplete();
  });
}

/**
 * Homophone pairs that sound the same but are spelled differently
 * If both words from a pair are in the queue, ensure they're not adjacent
 */
const HOMOPHONE_PAIRS = [
  ['there', 'their'],
  ['to', 'two'],
  ['know', 'no'],
];

/**
 * Separate homophones in the queue so they're not adjacent
 * This prevents confusion when a word is missed and retried
 */
function separateHomophones(queue) {
  if (queue.length < 2) return queue;

  const result = [...queue];
  const wordTexts = result.map(w => w.text.toLowerCase());

  // Find adjacent homophone pairs and swap to separate them
  for (let i = 0; i < result.length - 1; i++) {
    const currentWord = wordTexts[i];
    const nextWord = wordTexts[i + 1];

    // Check if current and next are homophones
    const areHomophones = HOMOPHONE_PAIRS.some(pair =>
      (pair.includes(currentWord) && pair.includes(nextWord))
    );

    if (areHomophones) {
      // Find a non-adjacent position to swap with
      // Try to find a word at least 2 positions away
      for (let j = i + 2; j < result.length; j++) {
        const candidateWord = wordTexts[j];
        // Make sure the candidate isn't a homophone of the current word
        const candidateIsHomophone = HOMOPHONE_PAIRS.some(pair =>
          (pair.includes(currentWord) && pair.includes(candidateWord))
        );

        if (!candidateIsHomophone) {
          // Swap next word with candidate
          [result[i + 1], result[j]] = [result[j], result[i + 1]];
          [wordTexts[i + 1], wordTexts[j]] = [wordTexts[j], wordTexts[i + 1]];
          break;
        }
      }
    }
  }

  return result;
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
