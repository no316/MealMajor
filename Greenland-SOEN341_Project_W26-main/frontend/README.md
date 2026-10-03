# MealMajor Frontend

A React + TypeScript web application for meal planning and healthy living, built with Vite.

## Tech Stack

- **React 19** - UI Library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **React Router DOM** - Client-side routing

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The app will be available at **http://localhost:5173**

### Production Build

Build the app for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Available Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Start development server                 |
| `npm run build`   | Build for production                     |
| `npm run preview` | Preview production build                 |
| `npm run lint`    | Run ESLint for code quality checks       |

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── assets/          # Images and other assets
│   ├── components/      # React components
│   │   ├── Login.tsx
│   │   ├── Registration.tsx
│   │   └── Profile.tsx
│   ├── App.tsx          # Main app component with routing
│   ├── App.css          # App styles
│   ├── index.css        # Global styles
│   └── main.tsx         # Entry point
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## Connecting to Backend

The frontend expects the backend API to be running at **http://localhost:3001**. Make sure to start the backend server before using features that require authentication.

See the [backend README](../backend/README.md) for setup instructions.
