/**
 * @file Registration.tsx
 * @description New user registration form for the MealMajor application.
 *
 * Collects first name, last name, email, password, and password confirmation.
 * Validates input on the client before calling `POST /api/register`.
 * On success, displays a success modal; on failure, inline error messages
 * are shown next to the relevant fields.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";
import { API_BASE_URL } from "../../config";

/** Shape of the registration form's controlled input state. */
interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Per-field and general validation/server error messages. */
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  /** Non-field error from the server (e.g. "Email already in use"). */
  general?: string;
}

/**
 * Registration page component.
 *
 * Manages form state, field-level validation, API submission, and
 * post-registration success feedback.
 */
function Registration() {
  const navigate = useNavigate();

  /** Controlled state for all registration form inputs. */
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  /** Validation and server error messages keyed by field name. */
  const [errors, setErrors] = useState<FormErrors>({});

  /** Whether to render the full-screen success overlay. */
  const [showSuccess, setShowSuccess] = useState(false);

  /** True while the API request is in-flight (disables the submit button). */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Generic change handler for all text inputs.
   * Updates the corresponding field and clears any existing error for it.
   *
   * @param e - The native input change event.
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear the field error as soon as the user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  /**
   * Form submit handler.
   *
   * Validates all required fields, checks password rules, then submits
   * the registration data to `POST /api/register`.
   *
   * @param e - The form submission event.
   */
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const newErrors: FormErrors = {};

    // ── Client-side validation ──────────────────────────────────────────
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);

    // Abort if there are any validation errors
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // ── API call ────────────────────────────────────────────────────
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show the server-provided error message (e.g. duplicate email)
        setErrors({ general: data.message || "Registration failed. Please try again." });
        return;
      }

      // Registration successful → show success overlay and reset form
      setShowSuccess(true);

      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
    } catch {
      // Network or unexpected error
      setErrors({ general: "Failed to connect to server. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigates to the login page.
   * Used both by the "Sign in" link and the success modal's "Go to Login" button.
   */
  const handleShowLogin = () => {
    navigate("/login");
  };

  return (
    <div className="registration-container">
      {/* ── Success overlay (shown after a successful registration) ── */}
      {showSuccess && (
        <div className="success-overlay" role="dialog" aria-live="polite">
          <div className="success-modal">
            <h2>Registration complete!</h2>
            <p>Your account has been created successfully.</p>
            <button
              type="button"
              className="success-link"
              onClick={handleShowLogin}
            >
              Go to Login
            </button>
          </div>
        </div>
      )}

      <div className="registration-card">
        <div className="logo-section">
          <h1>MealMajor</h1>
        </div>

        <p className="registration-subtitle">
          Plan meals, track groceries, discover easy recipes
        </p>

        <form onSubmit={handleSubmit} className="registration-form">
          {/* ── Name row ── */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
              />
              {errors.firstName && (
                <span className="error-message">{errors.firstName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
              {errors.lastName && (
                <span className="error-message">{errors.lastName}</span>
              )}
            </div>
          </div>

          {/* ── Email field ── */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
            />
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {/* ── Confirm password field ── */}
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          {/* ── General (non-field) error ── */}
          {errors.general && (
            <div className="general-error">{errors.general}</div>
          )}

          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Start your MealMajor journey!"}
          </button>
        </form>

        <p className="login-link">
          Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); handleShowLogin(); }}>Sign in</a>
        </p>
      </div>
    </div>
  );
}

export default Registration;
