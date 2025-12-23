import Dexie from 'dexie';
import { Child } from '../models/Child.js';
import { Word } from '../models/Word.js';

// Initialize Dexie database
const db = new Dexie('WordMasterDB');

// Version 1: Original schema
db.version(1).stores({
  children: '++id, name, createdAt',
  words: '++id, childId, position, drilled, createdAt, [childId+position]'
});

// Version 2: Add audioBlob support for ElevenLabs TTS caching
db.version(2).stores({
  children: '++id, name, createdAt',
  words: '++id, childId, position, drilled, createdAt, [childId+position]'
}).upgrade(tx => {
  // No schema change needed - Dexie handles adding new fields automatically
  // audioBlob will be stored as a Blob object in IndexedDB
  console.log('Database upgraded to version 2 (audioBlob support added)');
});

// Version 3: Add deletion tracking for sync
db.version(3).stores({
  children: '++id, name, createdAt',
  words: '++id, childId, position, drilled, createdAt, [childId+position]',
  deletedItems: '++id, itemType, itemKey, deletedAt' // Track deletions for sync
}).upgrade(tx => {
  console.log('Database upgraded to version 3 (deletion tracking added)');
});

/**
 * Initialize the database
 */
export async function initDB() {
  try {
    await db.open();
    console.log('Database initialized');
    return true;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * CHILD OPERATIONS
 */

export async function getChildren() {
  const children = await db.children.toArray();
  return children
    .filter(c => !c.deleted) // Filter out soft-deleted children
    .map(c => new Child(c));
}

/**
 * Get ALL children including deleted (for sync purposes)
 */
export async function getAllChildren() {
  const children = await db.children.toArray();
  return children.map(c => new Child(c));
}

export async function getChild(id) {
  const child = await db.children.get(id);
  return child ? new Child(child) : null;
}

export async function createChild(childData) {
  const child = new Child(childData);
  const data = child.toJSON();
  // Remove id for auto-increment
  delete data.id;
  const id = await db.children.add(data);
  child.id = id;
  return child;
}

export async function updateChild(id, updates) {
  // Always update lastModified when child settings change
  updates.lastModified = new Date().toISOString();
  await db.children.update(id, updates);
  return await getChild(id);
}

export async function deleteChild(id) {
  // Soft-delete: set deleted flag instead of removing from database
  await db.children.update(id, {
    deleted: true,
    lastModified: new Date().toISOString()
  });

  // Soft-delete all words for this child too
  const words = await db.words.where('childId').equals(id).toArray();
  for (const word of words) {
    await db.words.update(word.id, { deleted: true });
  }
}

/**
 * WORD OPERATIONS
 */

export async function getWords(childId) {
  const words = await db.words
    .where('childId')
    .equals(childId)
    .sortBy('position');
  return words
    .filter(w => !w.deleted) // Filter out soft-deleted words
    .map(w => new Word(w));
}

/**
 * Get ALL words including deleted (for sync purposes)
 */
export async function getAllWords(childId) {
  const words = await db.words
    .where('childId')
    .equals(childId)
    .sortBy('position');
  return words.map(w => new Word(w));
}

export async function getWord(id) {
  const word = await db.words.get(id);
  return word ? new Word(word) : null;
}

export async function createWord(wordData, audioBlob = null) {
  const word = new Word(wordData);

  // Get current words for this child to determine position
  const existingWords = await getWords(word.childId);

  // New words go to position 0 (front of queue)
  // Shift all existing words back by 1
  for (const existingWord of existingWords) {
    await db.words.update(existingWord.id, { position: existingWord.position + 1 });
  }

  word.position = 0;
  const data = word.toJSON();
  // Remove id for auto-increment
  delete data.id;

  // Add audioBlob if provided (will be stored as Blob in IndexedDB)
  if (audioBlob) {
    data.audioBlob = audioBlob;
  }

  const id = await db.words.add(data);
  word.id = id;

  // Update child's lastModified timestamp
  await db.children.update(word.childId, { lastModified: new Date().toISOString() });

  return word;
}

export async function updateWord(id, updates) {
  await db.words.update(id, updates);
  return await getWord(id);
}

export async function deleteWord(id) {
  const word = await db.words.get(id);
  if (!word) return;

  // Soft-delete: set deleted flag instead of removing from database
  // No need to reorder positions - deleted words are just invisible
  await db.words.update(id, { deleted: true });

  // Update child's lastModified timestamp
  await db.children.update(word.childId, { lastModified: new Date().toISOString() });
}

/**
 * QUEUE OPERATIONS
 */

/**
 * Get the next word from the queue (position 0)
 */
export async function getNextWord(childId) {
  const word = await db.words
    .where('[childId+position]')
    .equals([childId, 0])
    .first();
  return word ? new Word(word) : null;
}

/**
 * Move word to back of queue
 */
export async function moveWordToBack(wordId) {
  const word = await getWord(wordId);
  if (!word) return;

  const allWords = await getWords(word.childId);
  const maxPosition = Math.max(...allWords.map(w => w.position));

  // Move this word beyond current max position
  await db.words.update(wordId, { position: maxPosition + 1 });

  // Normalize all positions to remove gaps (0, 1, 2, ...)
  const updatedWords = await getWords(word.childId);
  for (let i = 0; i < updatedWords.length; i++) {
    if (updatedWords[i].position !== i) {
      await db.words.update(updatedWords[i].id, { position: i });
    }
  }
}

/**
 * Move word to position 1 (second in queue)
 */
export async function moveWordToSecond(wordId) {
  await moveWordToPosition(wordId, 1);
}

/**
 * Move word to a specific position in the queue
 * @param {number} wordId - Word ID
 * @param {number} targetPosition - Target position (0-indexed)
 */
export async function moveWordToPosition(wordId, targetPosition) {
  const word = await getWord(wordId);
  if (!word) return;

  const allWords = await getWords(word.childId);
  const currentPosition = word.position;

  // Clamp target position to valid range
  const maxPosition = allWords.length - 1;
  targetPosition = Math.max(0, Math.min(targetPosition, maxPosition));

  if (currentPosition === targetPosition) return;

  if (currentPosition < targetPosition) {
    // Moving word backward (higher position)
    // Shift words between current and target forward by 1
    for (const w of allWords) {
      if (w.position > currentPosition && w.position <= targetPosition) {
        await db.words.update(w.id, { position: w.position - 1 });
      }
    }
  } else {
    // Moving word forward (lower position)
    // Shift words between target and current backward by 1
    for (const w of allWords) {
      if (w.position >= targetPosition && w.position < currentPosition) {
        await db.words.update(w.id, { position: w.position + 1 });
      }
    }
  }

  await db.words.update(wordId, { position: targetPosition });
}

/**
 * Mark word as drilled
 */
export async function markWordDrilled(wordId) {
  await db.words.update(wordId, {
    drilled: true,
    lastPracticed: new Date().toISOString()
  });
}

/**
 * Record a spelling attempt
 */
export async function recordAttempt(wordId, success, errorCount = 0) {
  const word = await getWord(wordId);
  if (!word) return;

  const updates = {
    attempts: word.attempts + 1,
    successes: word.successes + (success ? 1 : 0),
    errors: word.errors + errorCount,
    lastPracticed: new Date().toISOString()
  };

  await db.words.update(wordId, updates);

  // Update child's lastModified timestamp (quiz progress changed)
  await db.children.update(word.childId, { lastModified: new Date().toISOString() });
}

/**
 * Record a sight-reading attempt (flashcard view)
 * @param {number} wordId - Word ID
 * @param {boolean} recognized - Did the child recognize it?
 */
export async function recordSightRead(wordId, recognized) {
  const word = await getWord(wordId);
  if (!word) return;

  const updates = {
    sightReadViews: (word.sightReadViews || 0) + 1,
    sightReadKnown: (word.sightReadKnown || 0) + (recognized ? 1 : 0),
    lastSightRead: new Date().toISOString()
  };

  await db.words.update(wordId, updates);
}

/**
 * Sort word queue by failed attempts (one-time initialization)
 * Priority:
 * 1. Words with failed attempts (attempts > successes) come first, sorted by number of failures (descending)
 * 2. Words with no failures stay in their original order at the back
 */
export async function sortWordQueue(childId) {
  const words = await getWords(childId);

  if (words.length === 0) return;

  // Separate words into two groups
  const wordsWithErrors = [];
  const wordsWithoutErrors = [];

  for (const word of words) {
    const failureCount = word.attempts - word.successes;
    if (failureCount > 0) {
      wordsWithErrors.push({ word, failureCount });
    } else {
      wordsWithoutErrors.push(word);
    }
  }

  // Sort words with errors by failure count (descending - most failures first)
  wordsWithErrors.sort((a, b) => b.failureCount - a.failureCount);

  // Combine: words with errors first, then words without errors (in original order)
  const sortedWords = [
    ...wordsWithErrors.map(item => item.word),
    ...wordsWithoutErrors
  ];

  // Update positions in database
  for (let i = 0; i < sortedWords.length; i++) {
    await db.words.update(sortedWords[i].id, { position: i });
  }

  console.log(`Sorted ${words.length} words for child ${childId} (${wordsWithErrors.length} with errors)`);
}

/**
 * Import common words for a child (with duplicate checking)
 * Returns the count of new words added
 * @param {number} childId - Child ID
 * @param {Array<string|Object>} wordList - Array of word strings or objects with {text, audioBlob}
 */
export async function importCommonWords(childId, wordList) {
  // Get existing words to check for duplicates
  const existingWords = await getWords(childId);
  const existingWordTexts = new Set(existingWords.map(w => w.text.toLowerCase()));

  // Normalize wordList to objects with text and optional audioBlob
  const normalizedWords = wordList.map(item =>
    typeof item === 'string' ? { text: item, audioBlob: null } : item
  );

  // Filter out duplicates
  const newWords = normalizedWords.filter(item =>
    !existingWordTexts.has(item.text.toLowerCase())
  );

  if (newWords.length === 0) {
    return { added: 0, skipped: wordList.length };
  }

  // Get current max position
  const maxPosition = existingWords.length > 0 ? Math.max(...existingWords.map(w => w.position)) : -1;

  // Add all new words at the back of the queue
  for (let i = 0; i < newWords.length; i++) {
    const word = new Word({
      text: newWords[i].text.toLowerCase(),
      childId: childId,
      position: maxPosition + 1 + i
    });

    const data = word.toJSON();
    delete data.id;

    // Add audioBlob if provided
    if (newWords[i].audioBlob) {
      data.audioBlob = newWords[i].audioBlob;
    }

    await db.words.add(data);
  }

  // Update child's lastModified timestamp
  await db.children.update(childId, { lastModified: new Date().toISOString() });

  console.log(`Imported ${newWords.length} new words for child ${childId} (skipped ${wordList.length - newWords.length} duplicates)`);

  return {
    added: newWords.length,
    skipped: wordList.length - newWords.length
  };
}

// Export the database instance for advanced usage
export { db };
