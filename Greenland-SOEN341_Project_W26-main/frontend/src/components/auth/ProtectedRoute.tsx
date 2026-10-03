/**
 * @file ProtectedRoute.tsx
 * @description Route guard component for authenticated pages.
 *
 * Implements US.06 – redirect to login when no valid session exists,
 * e.g. after the user has logged out or navigated directly to a
 * protected URL without being authenticated.
 */

import { Navigate, Outlet } from "react-router-dom";

/**
 * Route guard that checks for an active user session stored in `localStorage`.
 *
 * - If no session is found, the component redirects the user to `/login`
 *   (replacing the current history entry so they cannot navigate back).
 * - If a session exists, the nested child routes are rendered via {@link Outlet}.
 *
 * @example
 * // Used in App.tsx:
 * <Route element={<ProtectedRoute />}>
 *   <Route path="/profile" element={<Profile />} />
 * </Route>
 */
export default function ProtectedRoute() {
  // Check if a user session exists in localStorage
  const storedUser = localStorage.getItem("user");

  // No session → redirect to login immediately
  if (!storedUser) {
    return <Navigate to="/login" replace />;
  }

  // Session found → render the protected child routes
  return <Outlet />;
}
