/**
 * @file ViewRecipes.tsx
 * @description Recipe gallery / management page.
 *
 * Fetches and displays all recipes belonging to the logged-in user.
 * Supports:
 *  - **Real-time search** – debounced text search against recipe titles
 *    (300 ms delay).
 *  - **Filtering** – collapsible filter panel for prep/cook time, servings,
 *    dietary tags, and cost range.  All filters are applied server-side.
 *  - **Detail modal** – click a recipe card to open a full-screen detail view
 *    with ingredients, instructions, and edit/delete actions.
 *  - **Assign to meal plan** – inline date/meal-type picker per recipe card
 *    that creates or updates a meal plan slot via the API.
 */

import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { showToast } from "../layout/toastUtils";
import Modal from "../layout/Modal";
import RecipeModal from "./RecipeModal";
import { getRecipeImage } from "./recipeUtils";
import "./ViewRecipes.css";
import { API_BASE_URL } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a recipe object as returned by `GET /api/recipes`. */
export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  image?: string;
  dietaryTags?: string[];
  costEstimation?: string;
  ingredients: { id: number; name: string; amount: string; unit: string }[];
  instructions: { id: number; step: string }[];
  /** Owner's user ID. */
  userId: string;
  createdAt: string;
}

/** Meal-time slot keys accepted by the meal plan API. */
type MealTimeKey = "breakfast" | "lunch" | "dinner" | "snack";

/** Day-of-week keys accepted by the meal plan API. */
type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/** A map from meal-time key to recipe-name string for a single day. */
type DayMeals = Record<MealTimeKey, string>;

/** A full week's meal plan structure (one DayMeals per DayKey). */
type MealPlanDays = Record<DayKey, DayMeals>;

/** Default empty meal plan used when creating a new week for the first time. */
const EMPTY_DAYS: MealPlanDays = {
  monday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  tuesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  wednesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  thursday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  friday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  saturday: { breakfast: "", lunch: "", dinner: "", snack: "" },
  sunday: { breakfast: "", lunch: "", dinner: "", snack: "" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the ISO week identifier (e.g. `"2025-W03"`) for the week
 * that contains the given date.
 *
 * @param date - Any `Date` object.
 * @returns A string in `"YYYY-Www"` format (zero-padded week number).
 */
function getWeekIdForDate(date: Date): string {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (date.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000)
  );
  const week = Math.ceil((dayOfYear + oneJan.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Converts a `Date`'s day-of-week index to the corresponding {@link DayKey}.
 *
 * @param date - Any `Date` object.
 * @returns The lowercased English day name.
 */
function getDayKeyFromDate(date: Date): DayKey {
  const days: DayKey[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return days[date.getDay()];
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ViewRecipes page component.
 *
 * Renders a filterable, searchable recipe grid with a detail modal.
 * Handles recipe deletion and assignment to a weekly meal plan.
 */
const ViewRecipes: React.FC = () => {
  const navigate = useNavigate();

  /** The logged-in user's ID (loaded from localStorage). */
  const [userId, setUserId] = useState<string>("");

  /** The list of recipes currently rendered in the grid (post-filter). */
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  /** The recipe whose detail modal is currently open, or `null`. */
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  /** True while the initial or filter-triggered fetch is in-flight. */
  const [loading, setLoading] = useState(true);

  /** Error message to display when the fetch fails. */
  const [error, setError] = useState<string>("");

  /** True while a delete request is in-flight (disables the delete button). */
  const [deleting, setDeleting] = useState(false);

  /** Whether the filter panel is expanded. */
  const [showFilters, setShowFilters] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [maxPrepTime, setMaxPrepTime] = useState("");
  const [maxCookTime, setMaxCookTime] = useState("");
  const [minServings, setMinServings] = useState("");
  const [maxServings, setMaxServings] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minCost, setMinCost] = useState("");
  const [maxCost, setMaxCost] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // ── Meal plan assignment state ────────────────────────────────────────────
  /** ID of the recipe currently showing the assignment panel, or `null`. */
  const [assigningRecipeId, setAssigningRecipeId] = useState<string | null>(null);
  /** The date chosen for assignment (ISO `yyyy-mm-dd` string). */
  const [assignDate, setAssignDate] = useState<string>("");
  /** The meal type selected for assignment. */
  const [assignMealType, setAssignMealType] = useState<"breakfast" | "lunch" | "dinner" | "snack">("dinner");
  /** True while the assignment PATCH/POST requests are in-flight. */
  const [assigning, setAssigning] = useState(false);

  /** Dietary tag filter options. Must mirror the back-end's accepted values. */
  const TAG_OPTIONS = [
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Dairy-Free",
    "Nut-Free",
    "Pescatarian",
  ];

  /**
   * On mount: read the user's ID from localStorage so recipe requests
   * can be scoped to the current user.
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        if (userData.id) {
          setUserId(userData.id);
        }
      } catch (err) {
        console.error("Failed to parse user data:", err);
      }
    }
  }, []);

  /**
   * Fetches recipes from `GET /api/recipes`, optionally applying filter
   * query parameters.
   *
   * @param filters - Optional filter values; each is included in the query
   *   string only when non-empty.
   */
  const fetchRecipes = useCallback(async (filters?: {
    maxPrepTime?: string;
    maxCookTime?: string;
    minServings?: string;
    maxServings?: string;
    search?: string;
    selectedTags?: string[];
    minCost?: string;
    maxCost?: string;
  }) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();

      // Scope results to the current user
      if (userId) {
        params.set("userId", userId);
      }

      // Append filter params only when they have a non-empty value
      if (filters?.maxPrepTime) params.set("maxPrepTime", filters.maxPrepTime);
      if (filters?.maxCookTime) params.set("maxCookTime", filters.maxCookTime);
      if (filters?.minServings) params.set("minServings", filters.minServings);
      if (filters?.maxServings) params.set("maxServings", filters.maxServings);
      if (filters?.search) params.set("search", filters.search);
      if (filters?.selectedTags && filters.selectedTags.length > 0) {
        params.set('selectedTags', filters.selectedTags.join(','));
      }
      if (filters?.minCost) params.set('minCost', filters.minCost);
      if (filters?.maxCost) params.set('maxCost', filters.maxCost);

      const qs = params.toString();
      const res = await fetch(
        `${API_BASE_URL}/api/recipes${qs ? `?${qs}` : ""}`
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch recipes: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (data.success) {
        setRecipes(data.recipes || []);
      } else {
        setError(data.message || "Failed to load recipes");
      }
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
      setError("Unable to load recipes. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  /**
   * Debounced effect: re-fetches recipes whenever the user ID, any filter
   * value, or the search term changes.  The 300ms debounce prevents
   * excessive API calls while the user is typing in the search box.
   */
  useEffect(() => {
    if (!userId) return;
    const handler = setTimeout(() => {
      fetchRecipes({
        maxPrepTime,
        maxCookTime,
        minServings,
        maxServings,
        search: searchTerm,
        selectedTags,
        minCost,
        maxCost,
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [userId, maxPrepTime, maxCookTime, minServings, maxServings, searchTerm, selectedTags, minCost, maxCost, fetchRecipes]);

  /**
   * Deletes a recipe after a browser confirm dialog.
   * Requires the JWT token for Authorization.
   *
   * @param recipeId - The ID of the recipe to delete.
   */
  const handleDelete = async (recipeId: string) => {
    if (!window.confirm("Are you sure you want to delete this recipe?")) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/recipes/${recipeId}`, {
        method: "DELETE",
        headers,
      });
      const data = await res.json();
      if (data.success) {
        // Remove from local state without re-fetching
        setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
        setSelectedRecipe(null);
        showToast("Recipe deleted", "success");
      }
    } catch (err) {
      console.error("Failed to delete recipe:", err);
      showToast("Failed to delete recipe", "error");
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Assigns a recipe to the current user's meal plan for the selected
   * date and meal type.
   *
   * Flow:
   *  1. Derive the ISO week ID and day key from `assignDate`.
   *  2. `GET /api/mealplans?userId=...&weekId=...` to check for an existing plan.
   *  3. `POST /api/mealplans` to create one if it doesn't exist yet.
   *  4. `PATCH /api/mealplans/:id/slot` to write the recipe into the slot.
   *
   * @param recipe - The recipe to assign.
   */
  const handleAssignRecipe = async (recipe: Recipe) => {
    if (!userId) {
      setError("You must be logged in to assign a recipe.");
      return;
    }

    if (!assignDate) {
      setError("Please choose a date.");
      return;
    }

    setAssigning(true);
    setError("");

    try {
      const selectedDate = new Date(assignDate);
      const weekId = getWeekIdForDate(selectedDate);
      const dayKey = getDayKeyFromDate(selectedDate);

      // ── Step 1: check for an existing meal plan for this user/week ──
      const params = new URLSearchParams({ userId, weekId });
      const loadResp = await fetch(
        `${API_BASE_URL}/api/mealplans?${params.toString()}`
      );
      const loadData = await loadResp.json();

      if (!loadResp.ok || !loadData.success) {
        throw new Error(loadData.message || "Failed to load meal plan");
      }

      let planId: string | null =
        Array.isArray(loadData.mealPlans) && loadData.mealPlans.length > 0
          ? loadData.mealPlans[0].id
          : null;

      // ── Step 2: create a new meal plan if none exists ──
      if (!planId) {
        const createResp = await fetch(`${API_BASE_URL}/api/mealplans`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            weekId,
            days: EMPTY_DAYS,
          }),
        });

        const createData = await createResp.json();

        if (!createResp.ok || !createData.success) {
          throw new Error(createData.message || "Failed to create meal plan");
        }

        planId = createData.mealPlan?.id ?? null;
      }

      if (!planId) {
        throw new Error("Meal plan could not be created.");
      }

      // ── Step 3: write the recipe title into the specific slot ──
      const patchResp = await fetch(
        `${API_BASE_URL}/api/mealplans/${planId}/slot`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day: dayKey,
            meal: assignMealType,
            value: recipe.title,
          }),
        }
      );

      const patchData = await patchResp.json();

      if (!patchResp.ok || !patchData.success) {
        throw new Error(patchData.message || "Failed to assign recipe");
      }

      showToast(`Assigned "${recipe.title}" to ${dayKey} (${assignMealType})`, "success");

      // Reset the assignment panel state
      setAssigningRecipeId(null);
      setAssignDate("");
      setAssignMealType("dinner");
    } catch (err) {
      console.error("Failed to assign recipe:", err);
      const msg = err instanceof Error ? err.message : "Failed to assign recipe.";
      showToast(msg, "error");
    } finally {
      setAssigning(false);
    }
  };

  /**
   * True when at least one filter has a non-default (active) value.
   * Used to show/hide the "Clear Filters" button and the "(active)" label.
   */
  const hasActiveFilters =
    maxPrepTime || maxCookTime || minServings || maxServings || selectedTags.length > 0 || minCost || maxCost;

  /** Resets all active filter values to their defaults. */
  const clearFilters = () => {
    setMaxPrepTime("");
    setMaxCookTime("");
    setMinServings("");
    setMaxServings("");
    setSelectedTags([]);
    setMinCost("");
    setMaxCost("");
  };

  return (
    <div className="view-recipes-container">
      {/* ── Page header: title, search, and "New Recipe" button ── */}
      <header className="recipes-header">
        <div className="header-left">
          <h1 className="recipes-title">Recipes</h1>
          <p className="recipes-subtitle">
            Discover and manage your meal collection
          </p>
        </div>
        <div className="header-right">
          {/* Debounced search input */}
          <div className="search-wrapper">
            <input
              type="text"
              className="recipes-search-input"
              placeholder="Search recipes by name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search recipes by name"
            />
            <button
              className="clear-search-btn"
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              style={{ visibility: searchTerm ? 'visible' : 'hidden' }}
            >
              ✕
            </button>
          </div>
          <button
            className="create-recipe-btn"
            onClick={() => navigate("/createRecipe")}
          >
            + New Recipe
          </button>
        </div>
      </header>

      {/* ── Collapsible filter panel ── */}
      <div className="filter-bar">
        <button
          className={`filter-toggle-btn ${showFilters ? "active" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters {hasActiveFilters ? "(active)" : ""}
        </button>
        {showFilters && (
          <div className="filter-controls">
            {/* Max prep time filter */}
            <div className="filter-group">
              <label>Max Prep Time (min)</label>
              <input
                type="number"
                min="0"
                placeholder="Any"
                value={maxPrepTime}
                onChange={(e) => setMaxPrepTime(e.target.value)}
              />
            </div>

            {/* Max cook time filter */}
            <div className="filter-group">
              <label>Max Cook Time (min)</label>
              <input
                type="number"
                min="0"
                placeholder="Any"
                value={maxCookTime}
                onChange={(e) => setMaxCookTime(e.target.value)}
              />
            </div>

            {/* Dietary tag filter (multi-select chip buttons) */}
            <div className="filter-group">
              <label>Dietary Tags</label>
              <div className="tags-grid">
                {TAG_OPTIONS.map((t) => {
                  const active = selectedTags.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      className={`tag-chip ${active ? 'active' : ''}`}
                      onClick={() => setSelectedTags((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      aria-pressed={active}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cost range filter */}
            <div className="filter-group">
              <label>Cost ($)</label>
              <div className="cost-filter-row">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min"
                  value={minCost}
                  onChange={(e) => setMinCost(e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max"
                  value={maxCost}
                  onChange={(e) => setMaxCost(e.target.value)}
                />
              </div>
            </div>

            {/* Servings range filters */}
            <div className="filter-group">
              <label>Min Servings</label>
              <input
                type="number"
                min="1"
                placeholder="Any"
                value={minServings}
                onChange={(e) => setMinServings(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>Max Servings</label>
              <input
                type="number"
                min="1"
                placeholder="Any"
                value={maxServings}
                onChange={(e) => setMaxServings(e.target.value)}
              />
            </div>

            {/* Clear filters button – only visible when at least one filter is active */}
            {hasActiveFilters && (
              <button className="clear-filters-btn" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Main content area: error / loading / empty / grid ── */}
      {error ? (
        <div className="recipes-error">
          <h2>⚠️ Error Loading Recipes</h2>
          <p>{error}</p>
          <button
            className="retry-btn"
            onClick={() => fetchRecipes({ maxPrepTime, maxCookTime, minServings, maxServings })}
          >
            Try Again
          </button>
        </div>
      ) : loading ? (
        <div className="recipes-loading">
          <div className="loading-spinner"></div>
          <p>Loading your recipes...</p>
        </div>
      ) : !userId ? (
        /* User not loaded yet (race condition guard) */
        <div className="recipes-empty">
          <h2>Not logged in</h2>
          <p>Please log in to view your recipes</p>
          <button
            className="create-recipe-btn"
            onClick={() => navigate("/login")}
          >
            Go to Login
          </button>
        </div>
      ) : recipes.length === 0 && !hasActiveFilters ? (
        /* No recipes at all – prompt to create the first one */
        <div className="recipes-empty">
          <h2>No recipes yet</h2>
          <p>Create your first recipe to get started!</p>
          <button
            className="create-recipe-btn"
            onClick={() => navigate("/createRecipe")}
          >
            + Create Recipe
          </button>
        </div>
      ) : recipes.length === 0 ? (
        /* Active filters returned no results */
        <div className="recipes-empty">
          <h2>No matching recipes</h2>
          <p>Try adjusting your filters</p>
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        /* ── Recipe grid ── */
        <div className="recipes-grid">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="recipe-card-item"
              onClick={() => setSelectedRecipe(recipe)}
            >
              {/* Card thumbnail image */}
              <div className="recipe-card-image">
                <img
                  src={getRecipeImage(recipe)}
                  alt={recipe.title}
                  className="recipe-card-img"
                />
              </div>

              <div className="recipe-card-body">
                <h3 className="recipe-card-title">{recipe.title}</h3>

                {/* Colored meta row */}
                <div className="recipe-card-meta">
                  {Number(recipe.prepTime) > 0 && (
                    <span className="meta-badge meta-prep">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {recipe.prepTime}m prep
                    </span>
                  )}
                  {Number(recipe.cookTime) > 0 && (
                    <span className="meta-badge meta-cook">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {recipe.cookTime}m cook
                    </span>
                  )}
                  {Number(recipe.servings) > 0 && (
                    <span className="meta-badge meta-servings">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {recipe.servings}
                    </span>
                  )}
                  {recipe.costEstimation !== undefined && recipe.costEstimation !== null && Number(recipe.costEstimation) > 0 && (
                    <span className="meta-badge meta-cost">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      ${Number(recipe.costEstimation).toFixed(2)}
                    </span>
                  )}
                </div>

                {/* Dietary tags */}
                {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
                  <div className="tag-list-inline">
                    {recipe.dietaryTags.map((t) => {
                      const cls = `tag-${t.toLowerCase().replace(/[\s_]+/g, '-')}`;
                      return <span key={t} className={`tag-chip small ${cls}`}>{t}</span>;
                    })}
                  </div>
                )}

                {/* ── Card action buttons ── */}
                <div className="recipe-card-actions">
                  <button
                    type="button"
                    className="assign-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAssigningRecipeId(recipe.id);
                      setAssignDate("");
                      setAssignMealType("dinner");
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Assign
                  </button>
                  {recipe.userId === userId && (
                    <>
                      <button
                        type="button"
                        className="card-edit-button"
                        title="Edit recipe"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/editRecipe/${recipe.id}`);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        type="button"
                        className="card-delete-button"
                        title="Delete recipe"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(recipe.id);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Assign to Meal Plan Modal ── */}
      {assigningRecipeId && (
        <Modal
          open={!!assigningRecipeId}
          title="Assign to Meal Plan"
          onClose={() => setAssigningRecipeId(null)}
        >
          <div className="assign-modal-body">
            <p className="assign-modal-recipe-name">
              {recipes.find(r => r.id === assigningRecipeId)?.title}
            </p>
            <div className="assign-field">
              <label className="assign-label">Date</label>
              <input
                type="date"
                className="assign-date-input"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
              />
            </div>
            <div className="assign-field">
              <label className="assign-label">Meal Type</label>
              <select
                className="assign-meal-select"
                value={assignMealType}
                onChange={(e) => setAssignMealType(e.target.value as MealTimeKey)}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="assign-panel-actions">
              <button
                type="button"
                className="assign-cancel-btn"
                onClick={() => setAssigningRecipeId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="assign-confirm-btn"
                onClick={() => {
                  const recipe = recipes.find(r => r.id === assigningRecipeId);
                  if (recipe) void handleAssignRecipe(recipe);
                }}
                disabled={assigning}
              >
                {assigning ? "Saving..." : "Assign"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Recipe detail modal ── */}
      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onEdit={() => navigate(`/editRecipe/${selectedRecipe.id}`)}
          onDelete={() => handleDelete(selectedRecipe.id)}
          deleting={deleting}
        />
      )}
    </div>
  );
};

export default ViewRecipes;
