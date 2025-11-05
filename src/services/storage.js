import Dexie from 'dexie';
import { Child } from '../models/Child.js';
import { Word } from '../models/Word.js';

// Initialize Dexie database
const db = new Dexie('WordQuestDB');

db.version(1).stores({
  children: '++id, name, createdAt',
  words: '++id, childId, position, drilled, createdAt, [childId+position]'
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
  await db.children.update(id, updates);
  return await getChild(id);
}

export async function deleteChild(id) {
  // Delete all words for this child
  await db.words.where('childId').equals(id).delete();
  // Delete the child
  await db.children.delete(id);
}

/**
 * WORD OPERATIONS
 */

export async function getWords(childId) {
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

export async function createWord(wordData) {
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
  const id = await db.words.add(data);
  word.id = id;
  return word;
}

export async function updateWord(id, updates) {
  await db.words.update(id, updates);
  return await getWord(id);
}

export async function deleteWord(id) {
  const word = await getWord(id);
  if (!word) return;

  // Shift all words after this one forward by 1
  const wordsAfter = await db.words
    .where('childId')
    .equals(word.childId)
    .and(w => w.position > word.position)
    .toArray();

  for (const w of wordsAfter) {
    await db.words.update(w.id, { position: w.position - 1 });
  }

  await db.words.delete(id);
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
  const maxPosition = allWords.length - 1;

  // Shift all words between current position and end forward by 1
  for (const w of allWords) {
    if (w.position > word.position) {
      await db.words.update(w.id, { position: w.position - 1 });
    }
  }

  // Move this word to the back
  await db.words.update(wordId, { position: maxPosition });
}

/**
 * Move word to position 1 (second in queue)
 */
export async function moveWordToSecond(wordId) {
  const word = await getWord(wordId);
  if (!word) return;

  const allWords = await getWords(word.childId);

  // Shift all words between current position and position 1
  if (word.position > 1) {
    for (const w of allWords) {
      if (w.position >= 1 && w.position < word.position) {
        await db.words.update(w.id, { position: w.position + 1 });
      }
    }
  } else if (word.position === 0) {
    // If moving from position 0 to 1, shift position 1 to 0
    const wordAtOne = allWords.find(w => w.position === 1);
    if (wordAtOne) {
      await db.words.update(wordAtOne.id, { position: 0 });
    }
  }

  await db.words.update(wordId, { position: 1 });
}

/**
 * Get words that haven't been drilled yet
 */
export async function getUndrilledWords(childId) {
  const words = await db.words
    .where('childId')
    .equals(childId)
    .and(w => !w.drilled)
    .sortBy('position');
  return words.map(w => new Word(w));
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
}

// Export the database instance for advanced usage
export { db };
