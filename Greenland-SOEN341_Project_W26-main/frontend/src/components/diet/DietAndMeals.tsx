/**
 * @file DietAndMeals.tsx
 * @description Personalized 3-course meal generation page (US.20).
 *
 * Presents a questionnaire where the user can specify their cuisine
 * preference, serving size, budget, prep time, spice level, and
 * course-specific preferences.  On submission the component calls
 * `POST /api/gemini/meal-suggestion` to generate a complete starter,
 * main course, and dessert via the Gemini AI backend.
 *
 * For each generated course:
 *  - A Pexels image is automatically fetched in parallel.
 *  - Ingredients and instructions are shown in collapsible sections.
 *  - A "Save to Recipes" button persists the course to the user's
 *    recipe collection (`POST /api/recipes`).
 */

import { useState, useEffect, useCallback } from "react";

import { showToast } from "../layout/toastUtils";
import "./DietAndMeals.css";
import { API_BASE_URL } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** A single ingredient item within a course recipe. */
interface Ingredient {
  id: number;
  name: string;
  amount: string;
  unit: string;
}

/** A single cooking step within a course recipe. */
interface Instruction {
  id: number;
  step: string;
}

/** A single course (starter, main course, or dessert) as returned by Gemini. */
interface Course {
  name: string;
  description: string;
  image?: string;
  ingredients?: Ingredient[];
  instructions?: Instruction[];
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  dietaryTags?: string[];
  costEstimation?: string;
}

/** The full 3-course meal suggestion returned by the `/api/gemini/meal-suggestion` endpoint. */
interface MealSuggestion {
  starter: Course;
  mainCourse: Course;
  dessert: Course;
}

/** Minimal user identification stored in localStorage. */
interface User {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

/** Full user profile returned by `GET /api/profile/:id`. */
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dietPreference?: string;
  allergies?: string[];
  registeredAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diet & Meals page component.
 *
 * Orchestrates user input (questionnaire), meal generation via Gemini,
 * course image fetching via Pexels, and saving individual courses as
 * recipes to the user's collection.
 */
export default function DietAndMeals() {
  /** Minimal user object loaded from localStorage on mount. */
  const [user, setUser] = useState<User | null>(null);

  /** Full user profile fetched from the API (used for dietary context). */
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  /** The generated 3-course meal suggestion, or `null` before the first generation. */
  const [meal, setMeal] = useState<MealSuggestion | null>(null);

  /** True while the meal suggestion API call is in-flight. */
  const [loading, setLoading] = useState(false);

  /** Error message to display if meal generation or recipe saving fails. */
  const [error, setError] = useState("");

  // ── Questionnaire preference state ──────────────────────────────────────
  /** Preferred starter style (e.g. "light", "hearty"). */
  const [starterPreference, setStarterPreference] = useState("");
  /** Preferred main course style (e.g. "meat", "vegetarian"). */
  const [mainPreference, setMainPreference] = useState("");
  /** Preferred dessert style (e.g. "chocolate", "fruity"). */
  const [dessertPreference, setDessertPreference] = useState("");
  /** Cuisine type entered by the user (required field). */
  const [cuisine, setCuisine] = useState("");
  /** Number of servings selected by the user. */
  const [servings, setServings] = useState("");
  /** Budget level selected (low / medium / high). */
  const [budget, setBudget] = useState("");
  /** Maximum preparation time in minutes. */
  const [prepTime, setPrepTime] = useState("");
  /** Preferred spice level (mild / medium / spicy). */
  const [spiceLevel, setSpiceLevel] = useState("");

  // ── UI state ─────────────────────────────────────────────────────────────
  /** Transient success message shown after saving a course as a recipe. */
  const [savedMessage, setSavedMessage] = useState("");
  /** Set of section IDs (e.g. "starter-ingredients") that are currently expanded. */
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  /** Maps course key ("starter" | "mainCourse" | "dessert") to its fetched Pexels image URL. */
  const [courseImages, setCourseImages] = useState<Record<string, string>>({});
  /** Tracks which course images are still loading. */
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});

  /**
   * On mount: load the minimal user object from localStorage.
   * The full profile is fetched separately in `fetchUserProfile`.
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);

    }
  }, []);

  /**
   * Fetches the full user profile from the API so that dietary preferences
   * and allergies can be displayed and sent to Gemini.
   * Errors are silently logged without showing an error to the user.
   */
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch profile");
      }

      setUserProfile(data.user);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      // Don't show error to user, just log it
    }
  }, [user]);

  // Fetch profile whenever the user object becomes available
  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
    }
  }, [user, fetchUserProfile]);

  /**
   * Fetches a Pexels landscape photo for the given course and stores it
   * in `courseImages`.  Executed in parallel for all three courses after
   * a successful meal generation.
   *
   * @param courseKey  - One of `"starter"`, `"mainCourse"`, or `"dessert"`.
   * @param course     - The course data (name + description) to search for.
   */
  const generateCourseImageFetch = async (courseKey: string, course: { name: string; description: string }) => {
    setImageLoading(prev => ({ ...prev, [courseKey]: true }));
    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName: course.name,
          dishDescription: course.description,
        }),
      });
      const data = await response.json();
      if (response.ok && data.imageUrl) {
        setCourseImages(prev => ({ ...prev, [courseKey]: data.imageUrl }));
      }
    } catch (err) {
      console.error(`Failed to generate image for ${courseKey}:`, err);
    } finally {
      setImageLoading(prev => ({ ...prev, [courseKey]: false }));
    }
  };

  /**
   * Validates user input then calls `POST /api/gemini/meal-suggestion` to
   * generate a personalized 3-course meal.
   *
   * After a successful response, course images are fetched in parallel
   * (non-blocking) via `generateCourseImageFetch`.
   */
  const generateMeal = async () => {
    // Validate required cuisine field
    if (!cuisine.trim()) {
      setError("Please enter a cuisine");
      return;
    }
    if (!starterPreference || !mainPreference || !dessertPreference || !servings || !budget || !prepTime || !spiceLevel) {
      setError("Please fill in all preferences before generating.");
      return;
    }
    if (!user) {
      setError("User not found");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/meal-suggestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          cuisine: cuisine.trim(),
          servings,
          budget,
          prepTime,
          spiceLevel,
          starterPreference,
          mainPreference,
          dessertPreference,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate meal");
      }

      setMeal(data.suggestion);

      // Reset images and fetch new ones in parallel (non-blocking)
      setCourseImages({});
      const suggestion = data.suggestion;
      Promise.allSettled([
        generateCourseImageFetch("starter", suggestion.starter),
        generateCourseImageFetch("mainCourse", suggestion.mainCourse),
        generateCourseImageFetch("dessert", suggestion.dessert),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Saves a generated course recipe to the user's recipe collection.
   *
   * Validates that the course has at least one ingredient with a name and
   * at least one instruction step before sending to `POST /api/recipes`.
   *
   * @param courseName - Human-readable label (e.g. "Starter") for toast messages.
   * @param course     - The course data to save.
   * @param imageUrl   - Optional Pexels image URL to attach to the recipe.
   */
  const saveRecipeToCollection = async (courseName: string, course: Course, imageUrl?: string) => {
    if (!user) {
      setError("User not found");
      return;
    }

    // Filter out placeholder / empty ingredients
    const validIngredients = (course.ingredients || []).filter(
      (ing) => ing && typeof ing === 'object' && ing.name && typeof ing.name === 'string' && ing.name.trim()
    );
    if (validIngredients.length === 0) {
      setError("The generated recipe has no valid ingredients. Please try generating again.");
      showToast("Failed to save recipe: no valid ingredients", "error");
      return;
    }

    // Filter out placeholder / empty instruction steps
    const validInstructions = (course.instructions || []).filter(
      (inst) => inst && typeof inst === 'object' && inst.step && typeof inst.step === 'string' && inst.step.trim()
    );
    if (validInstructions.length === 0) {
      setError("The generated recipe has no valid instructions. Please try generating again.");
      showToast("Failed to save recipe: no valid instructions", "error");
      return;
    }

    try {
      // Build the recipe payload expected by the /api/recipes endpoint
      const recipeData = {
        title: course.name,
        description: course.description,
        servings: course.servings || servings,
        prepTime: course.prepTime || prepTime,
        cookTime: course.cookTime || "0",
        // Prefer the fetched Pexels image; fall back to Gemini-provided or empty
        image: imageUrl || course.image || "",
        dietaryTags: course.dietaryTags || (userProfile?.dietPreference ? [userProfile.dietPreference] : []),
        costEstimation: course.costEstimation,
        ingredients: validIngredients,
        instructions: validInstructions,
        userId: user.id,
      };

      const response = await fetch(`${API_BASE_URL}/api/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipeData),
      });

      if (response.ok) {
        setSavedMessage(`${courseName} saved to your recipes!`);
        showToast(`${courseName} saved to your recipes!`, "success");
        // Clear the transient success banner after 3 seconds
        setTimeout(() => setSavedMessage(""), 3000);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "Failed to save recipe");
        showToast("Failed to save recipe", "error");
      }
    } catch (err) {
      console.error("Error saving recipe:", err);
      setError("Error saving recipe");
      showToast("Error saving recipe", "error");
    }
  };

  /**
   * Toggles the expanded/collapsed state of a collapsible section.
   *
   * @param sectionId - Unique identifier for the section (e.g. `"starter-ingredients"`).
   */
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  return (
    <div className="diet-meals-container">
      <h1>Personalized Meal Generation</h1>

      {/* ── Questionnaire Section ── */}
      <div className="diet-questionnaire">
        <h2>Let's Create Your Perfect Meal!</h2>
        <p>Answer a few fun questions about your preferences, and we'll generate a personalized 3-course meal just for you.</p>

        <div className="questionnaire-grid">
          {/* ── Starter Preference ── */}
          <div className="input-group">
            <label htmlFor="starterPref">What's your ideal starter?</label>
            <select
              id="starterPref"
              value={starterPreference}
              onChange={(e) => setStarterPreference(e.target.value)}
            >
              <option value="" disabled>Select a starter...</option>
              <option value="light">Light &amp; Fresh</option>
              <option value="hearty">Hearty &amp; Filling</option>
              <option value="savory">Savory &amp; Bold</option>
              <option value="seafood">Seafood</option>
            </select>
          </div>

          {/* ── Main Course Preference ── */}
          <div className="input-group">
            <label htmlFor="mainPref">What do you prefer for the main course?</label>
            <select
              id="mainPref"
              value={mainPreference}
              onChange={(e) => setMainPreference(e.target.value)}
            >
              <option value="" disabled>Select a main course...</option>
              <option value="meat">Meat-Based</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="seafood">Seafood</option>
              <option value="balanced">Balanced Mix</option>
            </select>
          </div>

          {/* ── Dessert Preference ── */}
          <div className="input-group">
            <label htmlFor="dessertPref">How do you like to finish?</label>
            <select
              id="dessertPref"
              value={dessertPreference}
              onChange={(e) => setDessertPreference(e.target.value)}
            >
              <option value="" disabled>Select a dessert...</option>
              <option value="chocolate">Chocolate Lover</option>
              <option value="fruity">Fruity &amp; Fresh</option>
              <option value="creamy">Creamy &amp; Indulgent</option>
              <option value="light">Light &amp; Refreshing</option>
            </select>
          </div>

          {/* ── Cuisine (required free-text field) ── */}
          <div className="input-group">
            <label htmlFor="cuisine">What cuisine sounds good?</label>
            <input
              id="cuisine"
              type="text"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g., Italian, Thai, Mexican"
            />
          </div>

          {/* ── Servings ── */}
          <div className="input-group">
            <label htmlFor="servings">How many servings?</label>
            <select
              id="servings"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            >
              <option value="" disabled>Select servings...</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="4">4</option>
              <option value="6">6</option>
            </select>
          </div>

          {/* ── Budget ── */}
          <div className="input-group">
            <label htmlFor="budget">Budget</label>
            <select
              id="budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              <option value="" disabled>Select a budget...</option>
              <option value="low">Budget-Friendly</option>
              <option value="medium">Moderate</option>
              <option value="high">Premium</option>
            </select>
          </div>

          {/* ── Prep Time ── */}
          <div className="input-group">
            <label htmlFor="prepTime">How much time do you have?</label>
            <select
              id="prepTime"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
            >
              <option value="" disabled>Select prep time...</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>

          {/* ── Spice Level ── */}
          <div className="input-group">
            <label htmlFor="spiceLevel">Spice Level</label>
            <select
              id="spiceLevel"
              value={spiceLevel}
              onChange={(e) => setSpiceLevel(e.target.value)}
            >
              <option value="" disabled>Select spice level...</option>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="spicy">Spicy</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Current Dietary Preferences (fetched from the user profile) ── */}
      {userProfile && (
        <div className="dietary-preferences">
          <h2>Your Current Dietary Preferences</h2>
          <div className="preferences-content">
            <div className="preference-item">
              <strong>Diet Preference:</strong> {userProfile.dietPreference || "None specified"}
            </div>
            <div className="preference-item">
              <strong>Allergies:</strong> {userProfile.allergies && userProfile.allergies.length > 0
                ? userProfile.allergies.join(", ")
                : "None specified"}
            </div>
          </div>
          <p className="preferences-note">
            Your 3-course meal will be generated taking these preferences into account.
          </p>
        </div>
      )}

      {/* ── Generate Button ── */}
      <div className="generate-section">
        <h2>Ready to Generate Your Meal?</h2>
        <button onClick={generateMeal} disabled={loading} className="generate-btn">
          {loading ? "Generating..." : "Generate My Meal"}
        </button>
        {error && <p className="error">{error}</p>}
      </div>

      {/* ── Meal Display (rendered after a successful generation) ── */}
      {meal && (
        <div className="meal-display">
          <h2>Your 3-Course Meal</h2>
          <div className="courses">

            {/* ── Starter ── */}
            <div className="course-card">
              <div className="course-header">
                <h3>Starter</h3>
              </div>
              <div className="course-image">
                {imageLoading.starter ? (
                  <div className="image-loading-placeholder">
                    <span>Generating image...</span>
                  </div>
                ) : (
                  <img src={courseImages.starter || "/vite.svg"} alt={meal.starter.name} />
                )}
              </div>
              <div className="course-content">
                <h4>{meal.starter.name}</h4>
                <p className="description">{meal.starter.description}</p>

                {/* Collapsible ingredients list */}
                {meal.starter.ingredients && meal.starter.ingredients.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("starter-ingredients")}
                    >
                      <h5>Ingredients {expandedSections.has("starter-ingredients") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("starter-ingredients") && (
                      <ul>
                        {meal.starter.ingredients.map((ing, idx) => (
                          <li key={idx}>{ing.amount && ing.unit ? `${ing.amount} ${ing.unit}` : ""} {ing.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Collapsible instructions list */}
                {meal.starter.instructions && meal.starter.instructions.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("starter-instructions")}
                    >
                      <h5>Instructions {expandedSections.has("starter-instructions") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("starter-instructions") && (
                      <ol>
                        {meal.starter.instructions.map((inst, idx) => (
                          <li key={idx}>{inst.step}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {/* Timing / serving meta info */}
                <div className="course-meta">
                  {!!meal.starter.prepTime && <span>Prep: {meal.starter.prepTime} mins</span>}
                  {!!meal.starter.cookTime && <span>Cook: {meal.starter.cookTime} mins</span>}
                  {!!meal.starter.servings && <span>Servings: {meal.starter.servings}</span>}
                </div>

                <button
                  onClick={() => saveRecipeToCollection("Starter", meal.starter, courseImages.starter)}
                  className="save-recipe-btn"
                >
                  Save to Recipes
                </button>
              </div>
            </div>

            {/* ── Main Course ── */}
            <div className="course-card">
              <div className="course-header">
                <h3>Main Course</h3>
              </div>
              <div className="course-image">
                {imageLoading.mainCourse ? (
                  <div className="image-loading-placeholder">
                    <span>Generating image...</span>
                  </div>
                ) : (
                  <img src={courseImages.mainCourse || "/vite.svg"} alt={meal.mainCourse.name} />
                )}
              </div>
              <div className="course-content">
                <h4>{meal.mainCourse.name}</h4>
                <p className="description">{meal.mainCourse.description}</p>

                {/* Collapsible ingredients */}
                {meal.mainCourse.ingredients && meal.mainCourse.ingredients.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("main-ingredients")}
                    >
                      <h5>Ingredients {expandedSections.has("main-ingredients") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("main-ingredients") && (
                      <ul>
                        {meal.mainCourse.ingredients.map((ing, idx) => (
                          <li key={idx}>{ing.amount && ing.unit ? `${ing.amount} ${ing.unit}` : ""} {ing.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Collapsible instructions */}
                {meal.mainCourse.instructions && meal.mainCourse.instructions.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("main-instructions")}
                    >
                      <h5>Instructions {expandedSections.has("main-instructions") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("main-instructions") && (
                      <ol>
                        {meal.mainCourse.instructions.map((inst, idx) => (
                          <li key={idx}>{inst.step}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                <div className="course-meta">
                  {!!meal.mainCourse.prepTime && <span>Prep: {meal.mainCourse.prepTime} mins</span>}
                  {!!meal.mainCourse.cookTime && <span>Cook: {meal.mainCourse.cookTime} mins</span>}
                  {!!meal.mainCourse.servings && <span>Servings: {meal.mainCourse.servings}</span>}
                </div>

                <button
                  onClick={() => saveRecipeToCollection("Main Course", meal.mainCourse, courseImages.mainCourse)}
                  className="save-recipe-btn"
                >
                  Save to Recipes
                </button>
              </div>
            </div>

            {/* ── Dessert ── */}
            <div className="course-card">
              <div className="course-header">
                <h3>Dessert</h3>
              </div>
              <div className="course-image">
                {imageLoading.dessert ? (
                  <div className="image-loading-placeholder">
                    <span>Generating image...</span>
                  </div>
                ) : (
                  <img src={courseImages.dessert || "/vite.svg"} alt={meal.dessert.name} />
                )}
              </div>
              <div className="course-content">
                <h4>{meal.dessert.name}</h4>
                <p className="description">{meal.dessert.description}</p>

                {/* Collapsible ingredients */}
                {meal.dessert.ingredients && meal.dessert.ingredients.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("dessert-ingredients")}
                    >
                      <h5>Ingredients {expandedSections.has("dessert-ingredients") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("dessert-ingredients") && (
                      <ul>
                        {meal.dessert.ingredients.map((ing, idx) => (
                          <li key={idx}>{ing.amount && ing.unit ? `${ing.amount} ${ing.unit}` : ""} {ing.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Collapsible instructions */}
                {meal.dessert.instructions && meal.dessert.instructions.length > 0 && (
                  <div className="recipe-section">
                    <button
                      className="expand-toggle"
                      onClick={() => toggleSection("dessert-instructions")}
                    >
                      <h5>Instructions {expandedSections.has("dessert-instructions") ? "▼" : "▶"}</h5>
                    </button>
                    {expandedSections.has("dessert-instructions") && (
                      <ol>
                        {meal.dessert.instructions.map((inst, idx) => (
                          <li key={idx}>{inst.step}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                <div className="course-meta">
                  {!!meal.dessert.prepTime && <span>Prep: {meal.dessert.prepTime} mins</span>}
                  {!!meal.dessert.cookTime && <span>Cook: {meal.dessert.cookTime} mins</span>}
                  {!!meal.dessert.servings && <span>Servings: {meal.dessert.servings}</span>}
                </div>

                <button
                  onClick={() => saveRecipeToCollection("Dessert", meal.dessert, courseImages.dessert)}
                  className="save-recipe-btn"
                >
                  Save to Recipes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transient success banner shown after saving a course ── */}
      {savedMessage && (
        <div className="mealplan-message-success">
          {savedMessage}
        </div>
      )}
    </div>
  );
}