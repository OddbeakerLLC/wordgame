# Word Quest

A progressive web app (PWA) designed to help children master sight-reading and spelling through interactive drills and intelligent spaced repetition.

## Overview

Word Quest is a pedagogically-sound spelling game that uses multi-sensory learning (visual, auditory, and kinesthetic) combined with immediate error correction and spaced repetition to help children learn to spell the words they encounter most often in daily life and on their devices.

## Features

### For Kids
- **Interactive Word Drills**: Learn new words through seeing, hearing, and typing
- **Daily Quiz Mode**: Practice spelling from your personal word queue
- **Immediate Feedback**: Hear each letter as you type it
- **Smart Error Correction**: Mistakes are corrected immediately with visual and audio feedback
- **Rewarding Success**: Celebration animations and sounds when you master words
- **3D Visual Effects**: Engaging three.js powered animations

### For Parents & Teachers
- **Multiple Child Profiles**: Each child gets their own word list and progress
- **Easy Word Management**: Add, view, and remove words for each child
- **Intelligent Queue System**: Words adapt to each child's learning pace
- **Configurable Quiz Length**: Set how many words to practice per session (default: 5)
- **Offline-First**: Works without an internet connection
- **Progress Tracking**: See which words need more practice

## How It Works

### The Learning Algorithm

Word Quest uses an intelligent queue system designed around spaced repetition:

1. **New words** are added to the front of the queue and must be drilled before quizzing
2. **During drills**, children see the word, hear it spoken, and hear it spelled out letter-by-letter
3. **During quizzes**, children spell words from memory
4. **Words spelled correctly** (no errors) move to the back of the queue
5. **Words with errors** move to position #2 in the queue (so they practice the next word, then retry)
6. **Quiz completion** requires spelling 5 words correctly with no errors

This ensures children get more practice on difficult words while maintaining variety and avoiding frustration.

### Error Handling

When a child types an incorrect letter:
1. A buzzer sound plays
2. The correct letter is shown highlighted
3. Text-to-speech speaks the correct letter name
4. After 1-2 seconds, the word is cleared
5. The child tries again from the beginning

This immediate correction prevents practicing incorrect spellings while reinforcing the correct pattern.

## Tech Stack

- **Frontend**: Vite + Vanilla JavaScript
- **3D Graphics**: Three.js for animations and visual effects
- **Styling**: Tailwind CSS for responsive, beautiful UI
- **Storage**: IndexedDB (via Dexie.js) for robust local data persistence
- **Audio**: Web Speech API for text-to-speech, Howler.js for sound effects
- **PWA**: Vite PWA Plugin + Workbox for offline-first functionality
- **Future**: Cloud sync ready (placeholders for Firebase/Supabase integration)

## Installation

### For Users

Visit [deployed URL] and click "Install" in your browser to add Word Quest to your home screen.

### For Developers

```bash
# Clone the repository
git clone https://github.com/yourusername/wordgame.git
cd wordgame

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
wordgame/
├── public/
│   ├── sounds/              # Audio files (buzz, applause, fireworks)
│   └── manifest.json        # PWA manifest
├── src/
│   ├── components/          # UI components
│   ├── scenes/              # Three.js 3D scenes and animations
│   ├── services/
│   │   ├── storage.js       # IndexedDB wrapper for data persistence
│   │   ├── tts.js           # Text-to-speech functionality
│   │   ├── audio.js         # Sound effect management
│   │   └── queue.js         # Word queue logic
│   ├── models/              # Data models (Child, Word, Queue)
│   ├── styles/              # Global styles
│   ├── main.js              # Application entry point
│   └── index.html           # Main HTML file
├── package.json
├── vite.config.js
└── README.md
```

## Usage

### Getting Started

1. **Create a Child Profile**: Enter the child's name (this can be a spelling word too!)
2. **Add Words**: Go to the Parent/Teacher section and add words to the child's list
3. **Drill New Words**: Start a drill session to introduce the new words
4. **Daily Quiz**: Click the "Daily Quiz" button to begin practicing

### Parent/Teacher Features

Access the parent/teacher interface to:
- Add new child profiles
- Add words to each child's queue
- View existing words in the queue
- Remove words that have been mastered
- Configure quiz settings (number of words per session)
- View child progress

## Contributing

Contributions are welcome! This project is designed to help children learn, so we prioritize:
- **Accessibility**: Ensuring all children can use the app
- **Simplicity**: Keeping the interface intuitive
- **Evidence-based learning**: Features should align with learning science
- **Performance**: Fast, smooth animations even on older devices

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write clean, commented code
- Test on multiple devices (phones, tablets, desktops)
- Ensure PWA functionality works offline
- Keep animations smooth and non-distracting
- Follow accessibility best practices (WCAG guidelines)

## Roadmap

- [ ] Core game mechanics (drill & quiz modes)
- [ ] 3D animations and visual effects
- [ ] PWA installation and offline support
- [ ] Multiple child profiles
- [ ] Parent/teacher interface
- [ ] Sound effects and text-to-speech
- [ ] Cloud sync for cross-device usage
- [ ] Additional game modes (word matching, speed reading)
- [ ] Achievement system and badges
- [ ] Analytics for parents/teachers
- [ ] Import/export word lists
- [ ] Preset word lists (sight words, tech terms, etc.)

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

Built with love for children learning to read and spell. Inspired by the Dolch sight word methodology and modern spaced repetition techniques.

---

**Made with ❤️ for young learners everywhere**
