# Project Flux Tech Titans Arena

A local two-player Top Trumps-style card game built with Next.js, React, and TypeScript.

## Features

- 24-card technology leaders and computing legends deck
- Equal shuffled deal between Player 1 and Player 2
- Hidden defending card until a category is chosen
- Eight stat categories per card
- Rarity tiers and special abilities displayed on every card
- Draws move cards into a pending pot
- First player to capture all cards wins
- Dark Project Flux branded interface using `#ff2d55`
- Optional logo support via `public/project-flux-logo.png`
- Responsive desktop and mobile layout

## Project Structure

- `src/app/page.tsx` - Root game page
- `src/components/GameBoard.tsx` - Game state, round logic, controls, and arena layout
- `src/components/TitanCard.tsx` - Card presentation component
- `src/lib/techTitansDeck.ts` - 24-card deck data, stat labels, and TypeScript types
- `src/app/globals.css` - Project Flux visual styling and responsive rules

## Setup

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

Build for production:

```bash
npm run build
```

Start the production build:

```bash
npm run start
```

## Public Test Hosting

Render is the recommended first host for testing because this prototype uses server-side room state for online games.

1. Push this project to GitHub.
2. In Render, create a new Web Service from the GitHub repo.
3. Render can use `render.yaml` automatically, or configure it manually:

```bash
npm install && npm run build
```

Start command:

```bash
npx next start -H 0.0.0.0 -p $PORT
```

After deployment, share the Render URL with testers. Player 1 creates an online room in the app and sends the room link to Player 2.

Note: online rooms are stored in server memory for this prototype. Rooms reset when the Render service restarts. For longer public testing, move room state to Redis, Supabase, Firebase, or Postgres.

## Logo

If you have the Project Flux logo, place it at:

```text
public/project-flux-logo.png
```

The app falls back to a generated Project Flux mark if the file is not present.
