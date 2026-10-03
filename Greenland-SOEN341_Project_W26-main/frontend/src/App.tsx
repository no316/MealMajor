/**
 * @file App.tsx
 * @description Root application component.
 *
 * Defines the client-side route tree using React Router.
 * Routes are split into:
 *  - Public routes  → `/register` and `/login`
 *  - Protected routes → wrapped by {@link ProtectedRoute} so that
 *    unauthenticated users are redirected to `/login`.
 *    All protected pages are rendered inside {@link AppShell} which
 *    provides the sidebar navigation and header.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/auth/Login";
import Registration from "./components/auth/Registration";
import Profile from "./components/profile/Profile";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RecipeForm from "./components/recipes/RecipeForm";
import ViewRecipes from "./components/recipes/ViewRecipes";
import WeeklyPlanner from "./components/planner/WeeklyPlanner";
import DietAndMeals from "./components/diet/DietAndMeals";
import AppShell from "./components/layout/AppShell";
import ToastContainer from "./components/layout/Toast";
import "./App.css";

/**
 * Root application component.
 *
 * Renders a global {@link ToastContainer} (outside routes so notifications
 * are always visible) and the route configuration.
 */
function App() {
  return (
    <Router>
      {/* Global toast notification container – rendered above all routes */}
      <ToastContainer />
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/register" element={<Registration />} />
        <Route path="/login" element={<Login />} />

        {/* ── Protected routes (require an authenticated session) ── */}
        <Route element={<ProtectedRoute />}>
          {/* AppShell adds the sidebar nav and top toolbar */}
          <Route element={<AppShell />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/createRecipe" element={<RecipeForm />} />
            <Route path="/editRecipe/:id" element={<RecipeForm />} />
            <Route path="/viewRecipes" element={<ViewRecipes />} />
            <Route path="/weeklyPlanner" element={<WeeklyPlanner />} />
            <Route path="/dietAndMeals" element={<DietAndMeals />} />
          </Route>
        </Route>

        {/* Redirect root path to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
