# MealMajor
## Overview
MealMajor is an all in one web application designed for students to plan meals, manage groceries, and discover accessible recipes. It aims to simplify meal preparation and promote a healthy lifestyle for users on a busy schedule.

## Motivation Behind Features
The core motivation for MealMajor is to help students and busy individuals manage their diet efficiently, despite time constraints and limited budgets. The main features are designed with these specific goals in mind:

*   **User Account Management:** Personalizes the application experience by safely storing individual diet preferences, allergies, and nutritional profiles.
*   **Recipe Management:** Allow users to create, search, and filter recipes based on preparation time, difficulty, cost, and dietary tags.
*   **Weekly Meal Planner:** Spend less time thinking about what to eat. Users can prevent food waste and save time by scheduling their breakfasts, lunches, dinners, and snacks ahead of time in a weekly grid.

### Special Feature: 3-Course Meal Generator
MealMajor includes a unique **3-Course Meal Generator**. Powered by generative AI, this feature creates a cohesive, custom 3-course dining experience (appetizer, main course, and dessert) based on user identified criteria. It generates a full menu complete with detailed, step-by-step recipes, ingredient list, cost and cooking time.

## Technologies Used
*   **Frontend:** React 19, TypeScript, Vite, React Router DOM
*   **Backend:** Node.js, Express.js
*   **Authentication & Security:** JSON Web Tokens (jsonwebtoken), bcryptjs
*   **AI Integration:** Google Generative AI (Gemini) for smart meal generation
*   **Testing:** Jest, Supertest

## How to Run

### Prerequisites
*   Node.js (v18 or higher recommended)
*   npm

### Installation
1. Clone the repository.
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```
4. Create a `.env` file in the `backend` directory and add the necessary environment variables (e.g., your Google Generative AI API key, JWT secret).

### Running the Application
1. **Start the backend server:**
   Open a terminal, navigate to the `backend` directory, and run:
   ```bash
   npm run dev
   ```
   (This will start the server on the defined port, usually `http://localhost:3001`).

2. **Start the frontend development server:**
   Open a separate terminal, navigate to the `frontend` directory, and run:
   ```bash
   npm run dev
   ```
3. Open your browser and navigate to the local URL provided by Vite (typically `http://localhost:5173`).
