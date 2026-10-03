/**
 * @file Login.tsx
 * @description Login form component for the MealMajor application.
 *
 * Allows registered users to authenticate with their email and password.
 * On success the JWT token and user profile are persisted in `localStorage`
 * and the user is navigated to the recipe list (/viewRecipes).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import { API_BASE_URL } from "../../config";

/** Shape of the login form's controlled input state. */
interface LoginFormData {
  email: string;
  password: string;
}

/** Validation / server error messages for each login field. */
interface LoginErrors {
  email?: string;
  password?: string;
  /** Non-field error, e.g. wrong credentials or server failure. */
  general?: string;
}

/**
 * Login page component.
 *
 * Renders an email/password form with client-side validation.
 * Submits credentials to `POST /api/login` and handles the response.
 */
function Login() {
  const navigate = useNavigate();

  /** Controlled state for the email and password inputs. */
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  /** Per-field and general error messages shown below the inputs. */
  const [errors, setErrors] = useState<LoginErrors>({});

  /** True while waiting for the API response (disables the submit button). */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Generic change handler shared by all text inputs.
   * Updates the corresponding field in `formData` and clears any existing
   * error message for that field so the user gets immediate visual feedback.
   *
   * @param e - The native input change event.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear the field-specific error as soon as the user starts typing
    if (errors[name as keyof LoginErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  /**
   * Form submit handler.
   *
   * 1. Prevents the default browser submit.
   * 2. Validates email format and password presence on the client.
   * 3. Calls `POST /api/login` with the credentials.
   * 4. On success: persists the JWT token and user data, then navigates
   *    to `/viewRecipes`.
   * 5. On failure: displays the server error message or a connection error.
   *
   * @param e - The form submission event.
   */
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const newErrors: LoginErrors = {};

    // ── Client-side validation ──────────────────────────────────────────
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);

    // Abort submission if there are validation errors
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // ── API call ────────────────────────────────────────────────────
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show the server-provided error message (e.g. "Invalid email or password")
        setErrors({ general: data.message || "Invalid email or password" });
        return;
      }

      // ── Persist session data ────────────────────────────────────────
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.token) {
        localStorage.setItem('token', data.token);
      }

      // Navigate to the main recipes page after a successful login
      navigate("/viewRecipes");
    } catch {
      // Network or unexpected error
      setErrors({ general: "Failed to connect to server. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigates the user to the registration page.
   * Bound to the "Sign up" link at the bottom of the form.
   */
  const handleShowRegister = () => {
    navigate("/register");
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        <div className="logo-section">
          <h1>MealMajor</h1>
        </div>

        <p className="registration-subtitle">
          Welcome back!
        </p>

        <form onSubmit={handleSubmit} className="registration-form">
          {/* ── Email field ── */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "input-error" : ""}
            />
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          {/* ── Password field ── */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? "input-error" : ""}
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {/* ── General (non-field) error ── */}
          {errors.general && (
            <div className="general-error">{errors.general}</div>
          )}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log in to MealMajor"}
          </button>
        </form>

        <p className="login-link">
          Don&apos;t have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleShowRegister(); }}>Sign up</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
