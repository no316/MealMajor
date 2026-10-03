/**
 * @file useLogout.ts
 * @description Custom React hook for logging out the current user.
 *
 * Implements US.06 – Logout: when invoked, the hook clears all
 * session data from `localStorage` and redirects the browser to
 * the login page, replacing the current history entry so the user
 * cannot navigate back to the protected page with the back button.
 */

import { useNavigate } from "react-router-dom";

/**
 * Custom hook that returns a `logout` callback.
 *
 * Usage:
 * ```tsx
 * const logout = useLogout();
 * <button onClick={logout}>Log out</button>
 * ```
 *
 * @returns {() => void} A function that clears the user session and
 *   redirects to `/login`.
 */
export function useLogout() {
  const navigate = useNavigate();

  /**
   * Clears the persisted user session and navigates to the login page.
   *
   * Items removed from `localStorage`:
   *  - `"user"`  – serialised user profile object
   *  - `"token"` – JWT access token
   */
  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    // Replace history entry so the user cannot navigate back after logout
    navigate("/login", { replace: true });
  };

  return logout;
}
