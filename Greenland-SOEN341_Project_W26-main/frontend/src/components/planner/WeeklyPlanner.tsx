/**
 * @file WeeklyPlanner.tsx
 * @description Interactive weekly meal planner grid.
 *
 * Displays a 7-column × 4-row grid (days × meal types) where each cell can
 * hold a recipe or meal name.  Users can navigate between weeks, edit
 * individual cells in-place, and delete slot entries.
 *
 * The component syncs each cell save immediately via:
 *  `PATCH /api/mealplans/:id/slot` – updates a single slot.
 *
 * A new plan for the week is created on-demand via:
 *  `POST /api/mealplans`
 *
 * When a duplicate recipe is detected (server returns a 409-equivalent
 * message) a warning modal is shown instead of a generic error.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../layout/toastUtils";
import Modal from "../layout/Modal";
import RecipeModal from "../recipes/RecipeModal";
import type { Recipe } from "../recipes/ViewRecipes";
import "./WeeklyPlanner.css";
import { API_BASE_URL } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Ordered list of day labels used in the grid header row. */
const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────

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

/** Grid row definitions – one row per meal type. */
const mealSlots: { label: string; key: MealTimeKey }[] = [
  { label: "Breakfast", key: "breakfast" },
  { label: "Lunch", key: "lunch" },
  { label: "Dinner", key: "dinner" },
  { label: "Snack", key: "snack" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes an ISO week identifier (e.g. `"2025-W03"`) for the week
 * containing the given date.
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
 * Returns the Monday `Date` of the week containing `date`.
 *
 * @param date - Any `Date` object.
 * @returns A new `Date` set to 00:00:00 of the Monday in that week.
 */
function mondayOfWeekContaining(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // Difference to Monday: Sunday (day=0) goes back 6 days, other days go to 1–day
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** An empty meal-time record used to initialise every cell. */
const EMPTY_DAY: Record<MealTimeKey, string> = {
  breakfast: "",
  lunch: "",
  dinner: "",
  snack: "",
};

/**
 * Normalises a raw day entry from the API into a `Record<MealTimeKey, string>`.
 *
 * Handles two historic formats:
 *  - **Legacy string** – a single dinner value stored directly as a string.
 *  - **Current object** – an object with individual meal-slot keys.
 *
 * @param raw - The raw value from the server (may be any shape).
 * @returns A fully-typed `Record<MealTimeKey, string>`.
 */
function normalizeDayEntry(raw: unknown): Record<MealTimeKey, string> {
  // Legacy: a single string was stored for the whole day
  if (typeof raw === "string") {
    return { ...EMPTY_DAY, dinner: raw };
  }

  // Current: an object with individual slot keys
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    return {
      breakfast: String(o.breakfast ?? ""),
      lunch: String(o.lunch ?? ""),
      dinner: String(o.dinner ?? ""),
      snack: String(o.snack ?? ""),
    };
  }

  // Fallback: return an empty day
  return { ...EMPTY_DAY };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Weekly Planner page component.
 *
 * Renders a read/edit grid for the selected week.  Individual cells can be
 * edited inline without saving the entire plan at once – each cell save
 * triggers a PATCH request so changes are immediately persisted.
 */
export default function WeeklyPlanner() {
  const navigate = useNavigate();

  const [weekStart, setWeekStart] = useState(() => new Date());
  const [userId, setUserId] = useState<string | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [meals, setMeals] = useState<Record<DayKey, Record<MealTimeKey, string>>>(() => {
    const init = {} as Record<DayKey, Record<MealTimeKey, string>>;
    weekDays.forEach((day) => {
      init[day.toLowerCase() as DayKey] = { ...EMPTY_DAY };
    });
    return init;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{
    dayKey: DayKey;
    mealKey: MealTimeKey;
  } | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [duplicateModal, setDuplicateModal] = useState<string | null>(null);

  /** User's saved recipes for the recipe picker */
  const [userRecipes, setUserRecipes] = useState<Recipe[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");

  const monday = useMemo(() => mondayOfWeekContaining(weekStart), [weekStart]);
  const weekId = useMemo(() => getWeekIdForDate(monday), [monday]);

  /** Date numbers for each day of the week */
  const dayDates = useMemo(() => {
    return weekDays.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  const formatWeek = (date: Date) => {
    const week = mondayOfWeekContaining(date);
    const end = new Date(week);
    end.setDate(week.getDate() + 6);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${week.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
  };

  const prevWeek = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
  };

  const nextWeek = () => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
  };

  const goToToday = () => setWeekStart(new Date());

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      navigate("/login");
      return;
    }
    try {
      const u = JSON.parse(stored) as { id?: string };
      if (!u?.id) {
        navigate("/login");
        return;
      }
      setUserId(u.id);
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  /** Fetch user's recipes for the picker */
  const loadRecipes = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setUserRecipes(data.recipes || []);
      }
    } catch {
      // silent - recipes are optional for the picker
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void loadRecipes();
  }, [userId, loadRecipes]);

  const loadPlan = useCallback(async (opts?: { soft?: boolean }) => {
    if (!userId) return;
    const soft = opts?.soft === true;
    if (!soft) {
      setLoading(true);
      setEditing(null);
    }
    setError(null);
    try {
      const params = new URLSearchParams({ userId, weekId });
      const resp = await fetch(
        `${API_BASE_URL}/api/mealplans?${params.toString()}`
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || "Failed to load meal plan");
      }
      const plans = data.mealPlans as Array<{ id: string; days?: unknown }>;

      if (!Array.isArray(plans) || plans.length === 0) {
        setPlanId(null);
        const empty = {} as Record<DayKey, Record<MealTimeKey, string>>;
        weekDays.forEach((day) => {
          empty[day.toLowerCase() as DayKey] = { ...EMPTY_DAY };
        });
        setMeals(empty);
        return;
      }

      const plan = plans[0];
      setPlanId(plan.id);
      const serverDays = (plan.days || {}) as Record<string, unknown>;
      const next = {} as Record<DayKey, Record<MealTimeKey, string>>;
      weekDays.forEach((day) => {
        const dk = day.toLowerCase() as DayKey;
        next[dk] = normalizeDayEntry(serverDays[dk]);
      });
      setMeals(next);
    } catch (e: unknown) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Unable to load meal plan for this week."
      );
    } finally {
      if (!soft) {
        setLoading(false);
      }
    }
  }, [userId, weekId]);

  useEffect(() => {
    if (userId) void loadPlan();
  }, [userId, loadPlan]);

  const openPicker = (dayKey: DayKey, mealKey: MealTimeKey) => {
    setError(null);
    setEditing({ dayKey, mealKey });
    setRecipeSearch("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setRecipeSearch("");
  };

  /** Assign a recipe to the slot */
  const assignRecipe = async (recipeName: string) => {
    if (!planId || !editing) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/mealplans/${planId}/slot`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day: editing.dayKey,
            meal: editing.mealKey,
            value: recipeName,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        const msg = data.message || "Failed to update slot";
        if (msg.toLowerCase().includes("already assigned") || msg.toLowerCase().includes("duplicate")) {
          setDuplicateModal(msg);
        } else {
          throw new Error(msg);
        }
        return;
      }
      cancelEdit();
      await loadPlan({ soft: true });
      setError(null);
      showToast("Recipe assigned!", "success");
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to save this meal slot."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (dayKey: DayKey, mealKey: MealTimeKey) => {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/mealplans/${planId}/slot`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            day: dayKey,
            meal: mealKey,
            value: "",
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || "Failed to clear slot");
      }
      if (editing?.dayKey === dayKey && editing?.mealKey === mealKey) {
        cancelEdit();
      }
      await loadPlan({ soft: true });
      showToast("Meal removed", "success");
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Failed to delete this meal slot."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMealClick = async (title: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/recipes?userId=${userId}&search=${encodeURIComponent(title)}`);
      const data = await res.json();
      if (data.success && data.recipes && data.recipes.length > 0) {
        const match = data.recipes.find((r: Recipe) => r.title.toLowerCase() === title.toLowerCase());
        if (match) {
          setSelectedRecipe(match);
        } else {
          showToast("Recipe details not found.", "info");
        }
      } else {
        showToast("Recipe details not found.", "info");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch recipe details.", "error");
    }
  };

  const isToday = (date: Date) => {
    const now = new Date();
    return date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();
  };

  const filteredRecipes = userRecipes.filter(r =>
    r.title.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  return (
    <div className="weekly-planner-container">
      <div className="weekly-planner-card">
        <div className="planner-header">
          <h1>Weekly Meal Planner</h1>
          <button type="button" onClick={goToToday} className="today-button">
            Today
          </button>
        </div>

        <div className="week-controls">
          <button type="button" onClick={prevWeek} className="nav-button">
            ‹
          </button>
          <span className="week-label">{formatWeek(weekStart)}</span>
          <button type="button" onClick={nextWeek} className="nav-button">
            ›
          </button>
        </div>

        {error && (
          <div className="planner-error-banner" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-message">Loading your planner…</div>
        ) : (
          <>
            {!planId && (
              <div className="planner-notice planner-notice-warn">
                <p>No meal plan for this week yet.</p>
                <button
                  type="button"
                  className="nav-button"
                  disabled={saving}
                  onClick={async () => {
                    if (!userId) return;
                    setSaving(true);
                    setError(null);
                    try {
                      const resp = await fetch(`${API_BASE_URL}/api/mealplans`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId, weekId, days: {} }),
                      });
                      const data = await resp.json();
                      if (!resp.ok || !data.success) {
                        throw new Error(data.message || "Failed to create plan");
                      }
                      await loadPlan();
                      showToast("Meal plan created!", "success");
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "Failed to create meal plan.");
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? "Creating..." : "Create Meal Plan"}
                </button>
              </div>
            )}

            <div className="planner-grid calendar-grid">
              <div className="grid-header">
                <div className="grid-cell grid-corner"></div>
                {weekDays.map((day, i) => (
                  <div
                    key={`header-${day}`}
                    className={`grid-cell grid-day-header ${isToday(dayDates[i]) ? "today" : ""}`}
                  >
                    <span className="day-name">{day.slice(0, 3)}</span>
                    <span className={`day-date ${isToday(dayDates[i]) ? "today-date" : ""}`}>
                      {dayDates[i].getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {mealSlots.map(({ label, key }) => (
                <div key={`row-${label}`} className="grid-row">
                  <div className="grid-cell grid-meal-label">
                    {label}
                  </div>

                  {weekDays.map((day, dayIdx) => {
                    const dayKey = day.toLowerCase() as DayKey;
                    const text = meals[dayKey]?.[key] ?? "";
                    const isActive =
                      editing?.dayKey === dayKey && editing?.mealKey === key;

                    return (
                      <div
                        key={`${day}-${label}`}
                        className={`grid-cell grid-meal-slot ${isToday(dayDates[dayIdx]) ? "today-col" : ""} ${text ? "has-meal" : ""}`}
                      >
                        {isActive ? (
                          <div className="recipe-picker">
                            <input
                              className="recipe-picker-search"
                              type="text"
                              placeholder="Search recipes..."
                              value={recipeSearch}
                              onChange={(e) => setRecipeSearch(e.target.value)}
                              autoFocus
                            />
                            <div className="recipe-picker-list">
                              {filteredRecipes.length === 0 ? (
                                <div className="recipe-picker-empty">
                                  No recipes found.{" "}
                                  <button
                                    type="button"
                                    className="picker-link"
                                    onClick={() => navigate("/createRecipe")}
                                  >
                                    Create one
                                  </button>
                                </div>
                              ) : (
                                filteredRecipes.map((r) => (
                                  <button
                                    key={r.id}
                                    type="button"
                                    className="recipe-picker-item"
                                    disabled={saving}
                                    onClick={() => void assignRecipe(r.title)}
                                  >
                                    <span className="picker-title">{r.title}</span>
                                    {Number(r.prepTime) > 0 && (
                                      <span className="picker-meta">{r.prepTime}m</span>
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                            <button
                              type="button"
                              className="recipe-picker-cancel"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="meal-slot-content">
                            {text ? (
                              <>
                                <p
                                  className="meal-recipe"
                                  onClick={() => handleMealClick(text)}
                                  title="Click to view recipe"
                                >
                                  {text}
                                </p>
                                <div className="meal-slot-actions">
                                  <button
                                    type="button"
                                    className="cell-action-btn cell-action-btn-edit"
                                    disabled={!planId || saving}
                                    onClick={() => openPicker(dayKey, key)}
                                    title="Change recipe"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    type="button"
                                    className="cell-action-btn cell-action-btn-delete"
                                    disabled={!planId || saving}
                                    onClick={() => void deleteSlot(dayKey, key)}
                                    title="Remove meal"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="add-meal-btn"
                                disabled={!planId || saving}
                                onClick={() => openPicker(dayKey, key)}
                                title="Add a recipe"
                              >
                                +
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal
        open={!!duplicateModal}
        title="Duplicate Meal"
        onClose={() => setDuplicateModal(null)}
        variant="warning"
      >
        <p>{duplicateModal}</p>
        <p>Each recipe should only appear once per week. Try a different recipe for this slot.</p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn-secondary"
            onClick={() => setDuplicateModal(null)}
          >
            Got it
          </button>
        </div>
      </Modal>

      {selectedRecipe && (
        <RecipeModal
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  );
}
