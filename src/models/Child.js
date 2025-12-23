/**
 * Child Profile Model
 */
export class Child {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.inputMethod = data.inputMethod || 'keyboard'; // 'keyboard' | 'onscreen' | 'hybrid'
    this.quizLength = data.quizLength || 10; // Number of words per challenge session
    this.createdAt = data.createdAt || new Date().toISOString();
    this.lastModified = data.lastModified || new Date().toISOString(); // Updated when words/settings change
    this.deleted = data.deleted || false; // Soft delete flag
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      inputMethod: this.inputMethod,
      quizLength: this.quizLength,
      createdAt: this.createdAt,
      lastModified: this.lastModified,
      deleted: this.deleted
    };
  }
}
