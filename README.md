# 🎮 Advanced Interactive Hangman Game

A modern, polished single-page **Hangman** game built with **React + Vite + Tailwind CSS**.
The classic word-guessing loop, plus **difficulty levels** with varying word lengths and **dynamic random words fetched from a public word API**.

![Stack: React · Vite · Tailwind](https://img.shields.io/badge/stack-React%20%C2%B7%20Vite%20%C2%B7%20Tailwind-B8A9E8)
![License: MIT](https://img.shields.io/badge/license-MIT-1A1A1A)

---

## ✨ Features

### Core hangman mechanics
- ✅ Classic word-guessing gameplay with a live-drawn **SVG stick figure** that adds a body part on every wrong guess.
- ✅ Underscored letter slots that reveal as you match — green underlines for correct, coral for missed slots on a loss.
- ✅ **26-letter on-screen keyboard** (correct = green, wrong = coral, tried = disabled) — plus **physical keyboard support** (just type).
- ✅ Real-time timer, progress %, and a color-shifting "guesses remaining" meter (green → amber → coral as you approach defeat).
- ✅ Limited failure attempts per difficulty.

### 🔥 Difficulty levels (varying word lengths)
| Level  | Word length | Max wrong guesses |
|--------|-------------|-------------------|
| Easy   | 4 letters   | 8                 |
| Medium | 6 letters   | 7                 |
| Hard   | 8 letters   | 6                 |
| Expert | 10 letters  | 5                 |

### 🌐 Dynamic random words from an external public API
- Fetches from `https://random-word-api.herokuapp.com/word?length={N}` at the start of every game.
- Header shows a live indicator:
  - 🟢 **Wifi** — "Words from public API"
  - 🟡 **WifiOff** — "Offline word pack"
- Graceful fallback to a **curated offline word pool per difficulty** if the API is unreachable.

### 💡 Extras
- **Hint** button — reveals one letter but costs you a miss (one-use per game).
- **Give up** button mid-game.
- **Stats tab** — KPIs (games / wins / losses / win-rate), per-difficulty progress bars, and "milestones" (fastest win, fewest misses, longest word won).
- **History tab** — last 50 sessions with word, difficulty pill, misses / guesses / duration, and won/lost badge.
- All finished games are auto-saved to `localStorage` (`hangman:scores:v1`), so your record persists across sessions.

---

## 🚀 Getting started

### Prerequisites
- **Node.js 18+** and **npm** (or **pnpm** / **yarn**)

### Install & run
```bash
# 1. Unzip the project and cd into it
cd hangman-game

# 2. Install dependencies
npm install

# 3. Start the dev server (opens http://localhost:5173)
npm run dev
```

### Build for production
```bash
npm run build      # outputs to dist/
npm run preview    # preview the production build locally
```

The `dist/` folder is a static site — you can host it on any static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, etc.).

---

## 📁 Project structure
```
hangman-game/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          ← main game component (all UI + logic)
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Tailwind directives + global styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── LICENSE
└── README.md
```

---

## 🎨 Design language
The UI follows a modern Linear / Notion / Vercel-inspired aesthetic:

- Warm off-white page background (`#FAFAF8`), white cards, hairline `#F0F0F0` borders.
- Playful accent palette used liberally for badges, icons, and status dots:
  - **Lilac** `#B8A9E8` (primary CTA)
  - **Amber** `#F5A623`
  - **Teal** `#4ECDC4`
  - **Coral** `#FF6B6B`
  - **Green** `#4ADE80`
- Smooth 150–300ms transitions, pill-shaped tabs & buttons, and a frosted-glass sticky header.

---

## 🕹 How to play

1. Pick a **difficulty** — Easy → Expert.
2. Press **Start game**. A random word is fetched from the public API (or an offline pack falls back seamlessly).
3. Guess letters by clicking the on-screen keyboard **or typing on your physical keyboard**.
4. Each wrong guess draws another part of the hangman. Run out of wrong guesses → 💀 game over.
5. Reveal every letter of the word → 🏆 you win.
6. Use the ⚡ **Hint** to reveal one letter — but it costs one wrong-guess slot.
7. Check the **Stats** and **History** tabs to track your progress over time.

---

## 🔧 Tech stack
- **React 18** — UI library
- **Vite 5** — dev server + build tool
- **Tailwind CSS 3** — utility-first styling
- **lucide-react** — icon set
- Native `fetch()` for the public random-word API
- `localStorage` for score persistence (no backend needed)

---

## 📄 License
MIT — see [LICENSE](./LICENSE).

Have fun, and try beating expert mode! 💀
