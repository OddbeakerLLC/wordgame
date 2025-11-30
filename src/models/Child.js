/**
 * Child Profile Model
 */
export class Child {
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.inputMethod = data.inputMethod || 'keyboard'; // 'keyboard' | 'onscreen' | 'hybrid'
    this.quizLength = data.quizLength || 5; // Number of words to complete quiz
    this.drillLength = data.drillLength || 5; // Number of words to drill per session
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      inputMethod: this.inputMethod,
      quizLength: this.quizLength,
      drillLength: this.drillLength,
      createdAt: this.createdAt
    };
  }
}
