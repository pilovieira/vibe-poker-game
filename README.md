# 🃏 Vibe Poker Tracker

> **🤖 0.1% Human Oversight, 99.9% Artificial Intelligence (and 100% bluffing)**
> 
> This application was forged in the silicon silicon heart of a Large Language Model. While the human user provided the "vibe" and the occasional "hey, make that button shinier!", the AI handled the heavy lifting—writing the CSS that makes your mobile screen look like a high-stakes Vegas felt and JS logic that calculates pots faster than you can say "all-in."
>
> We asked the AI to build the ultimate poker companion, and it only tried to take a 5% rake once. If you find a bug, consider it a "hidden feature" added by the AI to keep you on your toes. It's not a glitch; it's a strategic misdirection.

---

A premium, mobile-responsive web application designed to manage, track, and celebrate your poker nights. From live blinds to all-time rankings, this app is the ultimate companion for your home games.

![Aesthetic](https://img.shields.io/badge/Design-Premium-gold)
![Status](https://img.shields.io/badge/Status-Live-success)
![Platform](https://img.shields.io/badge/Platform-Web--Responsive-blue)

---

## 🚀 Interactive Features

### 🏆 Ranking System
Experience a professional leaderboard system that tracks dominance across the years.
- **Yearly Sections**: Segmented rankings showing winners for each competitive season.
- **🌍 Global Leaderboard**: An aggregate "All-Time" ranking section at the bottom to identify the true legends.
- **🤝 Competition Logic**: Fair ranking for ties (e.g., if two players share 1st, the next is 3rd), ensuring every win counts.
- **Privacy Focus**: Ability to hide specific years (like "2000") from the public leaderboard while keeping the data for player stats.

### 👥 Player Management
- **Custom Avatars**: Integration for personalized player photos or sleek generic icons.
- **Player Profiles**: Click any player to open a detailed modal showing their total trophy count and Hall of Fame entries.
- **Dynamic Roster**: Add manual guest players on the fly during a game session.

### 🃏 The "Game" Dashboard
The nerve center of your poker night:

- **📢 Live Blinds**: Instant display of Small Blind and Big Blind values based on a selectable base.
- **💰 Prize Calculator**: 
    - Real-time calculation of the **Total Pot** based on Add-ons and Buy-in multiplier.
    - Automatic prize distribution: **1st Place (70%)** and **2nd Place (30%)** with smart rounding.
- **📍 Add-on Tracker**: Single-tap tracking for re-buys and add-ons. Players marked as "OUT" are automatically moved to the bottom and dimmed.

### ⭐ Hall of Fame
A dedicated space for the most rare and memorable hands in your group's history. Only the best Royal Flushes and Quad Tens make it here!

---

## 🛠️ Technical Details

- **Frontend**: Pure HTML5, CSS3 (Vanilla), and Modern JavaScript (ES6+).
- **Aesthetics**: Custom-designed "Poker Felt" theme with glassmorphism effects and vibrant gradients.
- **Responsive**: Mobile-first design. On small screens, the navbar collapses into an icon-only mode with tiny page labels for maximum space.
- **Persistence**: All live game data (blinds, add-ons, guest players) is persisted in `localStorage`. You can refresh the page or return later without losing your session.
- **Data Engine**: Centralized data management via `database.js` for easy updates to history and player avatars.

---

## 📂 Project Structure

- `index.html`: The core application hub containing all tabs and modals.
- `ranking.css`: A comprehensive design system covering everything from standard layouts to mobile-specific micro-interactions.
- `database.js`: The "Brain" of the app, storing historical rankings, Hall of Fame entries, and player metadata.
- `gallery/`: A directory for storing and recalling your best poker night moments.

---

## 🚦 Getting Started

1. **Clone the repository.**
2. **Open `index.html`** in any modern web browser.
3. **Pro Tip**: Run via a local server (e.g., `python3 -m http.server 8000`) to enable dynamic features like the gallery scanner.

---

*Built with ❤️ for the love of the game.*
