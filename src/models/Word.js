/**
 * Word Model
 */
export class Word {
  constructor(data = {}) {
    this.id = data.id || null;
    this.text = data.text || '';
    this.childId = data.childId || null;
    this.position = data.position || 0; // Position in queue (0 = front)
    this.drilled = data.drilled || false; // Has this word been drilled at least once?
    this.attempts = data.attempts || 0; // Total attempts
    this.successes = data.successes || 0; // Successful spellings
    this.errors = data.errors || 0; // Total errors made
    this.lastPracticed = data.lastPracticed || null;
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      text: this.text,
      childId: this.childId,
      position: this.position,
      drilled: this.drilled,
      attempts: this.attempts,
      successes: this.successes,
      errors: this.errors,
      lastPracticed: this.lastPracticed,
      createdAt: this.createdAt
    };
  }

  /**
   * Calculate success rate (0-1)
   */
  get successRate() {
    if (this.attempts === 0) return 0;
    return this.successes / this.attempts;
  }

  /**
   * Check if word needs more practice
   */
  needsPractice() {
    return this.errors > 0 || this.attempts < 3;
  }
}
