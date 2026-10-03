# MealMajor Backend

A Node.js + Express REST API for our MealMajor application, handling user authentication and data management.

## Tech Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **CORS** - Cross-origin resource sharing middleware
- **File-based JSON storage** - Simple data persistence

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- npm (comes with Node.js)

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will run at **http://localhost:3001**

## Available Scripts

| Command         | Description                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Start server with file watching (auto-reload) |
| `npm start`     | Start server in production mode          |

## API Endpoints

### Authentication

| Method | Endpoint            | Description                |
|--------|---------------------|----------------------------|
| POST   | `/api/register`     | Register a new user        |
| POST   | `/api/login`        | Log in an existing user    |
| GET    | `/api/profile/:id`  | Get user profile by ID     |

### Request/Response Examples

#### Register
```bash
POST /api/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### Login
```bash
POST /api/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

## Project Structure

```
backend/
├── data/
│   └── users.json       # User data storage (auto-created)
├── routes/
│   └── auth.js          # Authentication routes
├── server.js            # Main server entry point
├── app.js               # Express app configuration
└── package.json         # Dependencies and scripts
```

## Data Storage

User data is stored in `data/users.json`. This file is automatically created when the server starts if it doesn't exist.
