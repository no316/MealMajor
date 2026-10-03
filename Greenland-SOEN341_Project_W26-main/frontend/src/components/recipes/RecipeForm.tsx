/**
 * @file RecipeForm.tsx
 * @description Create / Edit recipe form component.
 *
 * Used for two routes:
 *  - `/createRecipe`  – initialises with empty fields, submits via `POST /api/recipes`.
 *  - `/editRecipe/:id` – pre-fills fields from the existing recipe, submits via
 *    `PUT /api/recipes/:id`.
 *
 * Features:
 *  - Dynamic ingredient and instruction lists (add/remove rows).
 *  - Optional image: upload a file (`POST /api/recipes/upload`) **or** find a
 *    relevant photo via Pexels (`POST /api/gemini/generate-image`).
 *  - Dietary tag chips (toggle selection).
 *  - Client-side field validation before submission.
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { showToast } from "../layout/toastUtils";
import "./RecipeForm.css";
import { API_BASE_URL } from "../../config";

// ─────────────────────────────────────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────────────────────────────────────

/** A single ingredient row in the form. */
interface Ingredient {
  id: number;
  name: string;
  amount: string;
  unit: string;
}

/** A single instruction step row in the form. */
interface Instruction {
  id: number;
  step: string;
}

/** The full shape of the recipe form's controlled state. */
interface RecipeFormData {
  title: string;
  description: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  /** URL of the recipe image (may be a local server path or a CDN URL). */
  image?: string;
  dietaryTags?: string[];
  costEstimation?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
  /** The owning user's ID – injected from localStorage. */
  userId?: string;
}

/** Per-field client-side validation error messages. */
interface FormErrors {
  title?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  ingredients?: string;
  instructions?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recipe create/edit form component.
 *
 * Detects whether it is in "create" or "edit" mode by checking for a
 * `:id` route parameter.  In edit mode the existing recipe is fetched
 * from the API on mount and used to pre-fill the form.
 */
function RecipeForm() {
  const navigate = useNavigate();
  const { id: recipeId } = useParams<{ id: string }>();

  /** True when the component is used on the `/editRecipe/:id` route. */
  const isEditMode = Boolean(recipeId);

  /** Full form data driving all controlled inputs. */
  const [formData, setFormData] = useState<RecipeFormData>({
    title: "",
    description: "",
    servings: "",
    prepTime: "",
    cookTime: "",
    image: "",
    dietaryTags: [],
    costEstimation: "",
    ingredients: [{ id: 1, name: "", amount: "", unit: "" }],
    instructions: [{ id: 1, step: "" }],
  });

  /**
   * Counter used to assign unique IDs to newly added ingredient rows.
   * Prevents React key collisions after rows are added/removed.
   */
  const [nextIngredientId, setNextIngredientId] = useState(2);

  /** Counter used to assign unique IDs to newly added instruction rows. */
  const [nextInstructionId, setNextInstructionId] = useState(2);

  /** True while the create/update API call is in-flight. */
  const [isLoading, setIsLoading] = useState(false);

  /** True while the existing recipe is being fetched in edit mode. */
  const [isFetchingRecipe, setIsFetchingRecipe] = useState(false);

  /** True while a file is being uploaded to the image endpoint. */
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  /** True while a Pexels image search is in-flight. */
  const [isFindingImage, setIsFindingImage] = useState(false);

  /** Top-level success or error message, shown below the form heading. */
  const [message, setMessage] = useState("");

  /** Per-field validation errors for the current or most recent submit attempt. */
  const [errors, setErrors] = useState<FormErrors>({});

  /**
   * On mount: inject the logged-in user's ID from localStorage into the form
   * so that the recipe is associated with the correct user on creation.
   */
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setFormData((prev) => ({ ...prev, userId: userData.id }));
      } catch {
        // ignore invalid localStorage data
      }
    }
  }, []);

  /**
   * In edit mode: fetch the existing recipe from `GET /api/recipes/:id`
   * and populate all form fields.  Runs whenever `recipeId` changes.
   */
  useEffect(() => {
    if (!recipeId) return;
    setIsFetchingRecipe(true);
    fetch(`${API_BASE_URL}/api/recipes/${recipeId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.recipe) {
          const r = data.recipe;

          // Normalise ingredients to the form's shape (add sequential IDs)
          const ingredients: Ingredient[] =
            r.ingredients?.map((ing: Ingredient, i: number) => ({
              id: i + 1,
              name: ing.name || "",
              amount: ing.amount?.toString() || "",
              unit: ing.unit || "",
            })) || [{ id: 1, name: "", amount: "", unit: "" }];

          // Normalise instructions to the form's shape
          const instructions: Instruction[] =
            r.instructions?.map((inst: Instruction, i: number) => ({
              id: i + 1,
              step: inst.step || "",
            })) || [{ id: 1, step: "" }];

          setFormData({
            title: r.title || "",
            description: r.description || "",
            servings: r.servings?.toString() || "",
            prepTime: r.prepTime?.toString() || "",
            cookTime: r.cookTime?.toString() || "",
            image: r.image || "",
            dietaryTags: r.dietaryTags || [],
            costEstimation: r.costEstimation?.toString() || "",
            ingredients,
            instructions,
            userId: r.userId,
          });

          // Advance ID counters past the loaded rows to avoid collisions
          setNextIngredientId(ingredients.length + 1);
          setNextInstructionId(instructions.length + 1);
        }
      })
      .catch((err) => console.error("Failed to fetch recipe:", err))
      .finally(() => setIsFetchingRecipe(false));
  }, [recipeId]);

  /**
   * Validates all form fields and populates the `errors` state.
   *
   * @returns `true` if the form is valid and can be submitted.
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Title is required
    if (!formData.title.trim()) {
      newErrors.title = "Recipe title is required";
    }

    // Servings must be a positive number if provided
    if (formData.servings.trim()) {
      if (isNaN(Number(formData.servings)) || Number(formData.servings) <= 0) {
        newErrors.servings = "Servings must be a positive number";
      }
    }

    // Prep time must be non-negative if provided
    if (formData.prepTime.trim()) {
      if (isNaN(Number(formData.prepTime)) || Number(formData.prepTime) < 0) {
        newErrors.prepTime = "Prep time must be a non-negative number";
      }
    }

    // Cook time must be non-negative if provided
    if (formData.cookTime.trim()) {
      if (isNaN(Number(formData.cookTime)) || Number(formData.cookTime) < 0) {
        newErrors.cookTime = "Cook time must be a non-negative number";
      }
    }

    // Cost estimation must be non-negative if provided
    if (formData.costEstimation && formData.costEstimation.trim()) {
      if (isNaN(Number(formData.costEstimation)) || Number(formData.costEstimation) < 0) {
        newErrors.cookTime = "Cost estimation must be a non-negative number";
      }
    }

    // At least one ingredient must have a name
    const hasValidIngredient = formData.ingredients.some((ing) =>
      ing.name.trim()
    );
    if (!hasValidIngredient) {
      newErrors.ingredients = "At least one ingredient with a name is required";
    } else {
      // Ingredient amounts must be numeric if provided
      for (const ing of formData.ingredients) {
        if (ing.amount.trim() && isNaN(Number(ing.amount))) {
          newErrors.ingredients = "Ingredient amounts must be valid numbers";
          break;
        }
      }
    }

    // At least one non-empty instruction step is required
    const hasValidInstruction = formData.instructions.some((inst) =>
      inst.step.trim()
    );
    if (!hasValidInstruction) {
      newErrors.instructions = "At least one instruction is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** Dietary tag options available for selection. */
  const TAG_OPTIONS = [
    "Vegetarian",
    "Vegan",
    "Gluten-Free",
    "Dairy-Free",
    "Nut-Free",
    "Pescatarian",
  ];

  /**
   * Toggles a dietary tag on or off.
   *
   * @param tag - The tag string to toggle.
   */
  const toggleTag = (tag: string) => {
    setFormData((prev) => {
      const tags = prev.dietaryTags || [];
      if (tags.includes(tag)) {
        return { ...prev, dietaryTags: tags.filter((t) => t !== tag) };
      }
      return { ...prev, dietaryTags: [...tags, tag] };
    });
  };

  /**
   * Generic change handler for text inputs and textareas.
   * Updates the corresponding field and clears any existing validation error.
   *
   * @param e - The native change event.
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  /**
   * Updates a single field in a specific ingredient row.
   *
   * @param id    - The ingredient row ID.
   * @param field - The field to update (`name`, `amount`, or `unit`).
   * @param value - The new value.
   */
  const handleIngredientChange = (
    id: number,
    field: keyof Ingredient,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  /**
   * Updates the `step` text of a specific instruction row.
   *
   * @param id    - The instruction row ID.
   * @param value - The new step text.
   */
  const handleInstructionChange = (id: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst) =>
        inst.id === id ? { ...inst, step: value } : inst
      ),
    }));
  };

  /** Appends a new blank ingredient row to the list. */
  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { id: nextIngredientId, name: "", amount: "", unit: "" },
      ],
    }));
    setNextIngredientId(nextIngredientId + 1);
  };

  /**
   * Removes an ingredient row from the list.
   *
   * @param id - The row ID to remove.
   */
  const removeIngredient = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }));
  };

  /** Appends a new blank instruction row to the list. */
  const addInstruction = () => {
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, { id: nextInstructionId, step: "" }],
    }));
    setNextInstructionId(nextInstructionId + 1);
  };

  /**
   * Removes an instruction row from the list.
   *
   * @param id - The row ID to remove.
   */
  const removeInstruction = (id: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((inst) => inst.id !== id),
    }));
  };

  /**
   * Handles file selection for the recipe image.
   * Uploads the file to `POST /api/recipes/upload` and stores the returned URL.
   *
   * @param e - The file input change event.
   */
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch(`${API_BASE_URL}/api/recipes/upload`, {
        method: "POST",
        body,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setFormData((prev) => ({ ...prev, image: data.url }));
      }
    } catch (err) {
      console.error("Image upload failed:", err);
    } finally {
      setIsUploadingImage(false);
      // Reset the file input so the same file can be selected again if needed
      e.target.value = "";
    }
  };

  /** Clears the currently set recipe image URL. */
  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
  };

  /**
   * Searches Pexels for an image matching the recipe's title and description.
   * Calls `POST /api/gemini/generate-image` and sets the returned URL as the recipe image.
   * Requires both title and description to be non-empty.
   */
  const findRelatedImage = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast("Please fill out the title and description first.", "error");
      return;
    }
    setIsFindingImage(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dishName: formData.title,
          dishDescription: formData.description,
        }),
      });
      const data = await response.json();
      if (response.ok && data.imageUrl) {
        setFormData((prev) => ({ ...prev, image: data.imageUrl }));
        showToast("Found a related image!", "success");
      } else {
        showToast("Failed to find related image.", "error");
      }
    } catch (err) {
      console.error("Image search error:", err);
      showToast("Error finding image.", "error");
    } finally {
      setIsFindingImage(false);
    }
  };

  /**
   * Form submission handler.
   *
   * Validates the form, then calls either `POST /api/recipes` (create) or
   * `PUT /api/recipes/:id` (update) depending on `isEditMode`.
   * Resets the form on a successful creation.
   *
   * @param e - The form submission event.
   */
  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setMessage("");

    // Abort if client-side validation fails
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      // Determine the correct URL and HTTP method based on the current mode
      const url = isEditMode
        ? `${API_BASE_URL}/api/recipes/${recipeId}`
        : `${API_BASE_URL}/api/recipes`;
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage(
          isEditMode
            ? "Recipe updated successfully!"
            : "Recipe created successfully!"
        );
        showToast(
          isEditMode ? "Recipe updated!" : "Recipe created!",
          "success"
        );

        // Reset form to empty state after a successful creation
        if (!isEditMode) {
          setFormData({
            title: "",
            description: "",
            servings: "",
            prepTime: "",
            cookTime: "",
            image: "",
            ingredients: [{ id: 1, name: "", amount: "", unit: "" }],
            instructions: [{ id: 1, step: "" }],
          });
          setNextIngredientId(2);
          setNextInstructionId(2);
          setErrors({});
        }
      } else {
        setMessage(
          isEditMode
            ? "Failed to update recipe. Please try again."
            : "Failed to create recipe. Please try again."
        );
      }
    } catch (error) {
      console.error("Error saving recipe:", error);
      setMessage("Error saving recipe. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show a loading indicator while the existing recipe is being fetched in edit mode
  if (isFetchingRecipe) {
    return (
      <div className="recipe-container">
        <div className="recipe-card" style={{ textAlign: "center", padding: 80 }}>
          Loading recipe...
        </div>
      </div>
    );
  }

  return (
    <div className="recipe-container">
      <div className="recipe-card">
        <h1>{isEditMode ? "Edit Recipe" : "Create a Recipe"}</h1>

        {/* Top-level status message (success or failure) */}
        {message && (
          <div
            className={`message ${message.includes("successfully") ? "success" : "error"}`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="recipe-form">
          {/* ── Title ── */}
          <div className="form-group">
            <label htmlFor="title">Recipe Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Chocolate Chip Cookies"
              className={errors.title ? "input-error" : ""}
            />
            {errors.title && (
              <span className="error-message">{errors.title}</span>
            )}
          </div>

          {/* ── Description ── */}
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Brief description of your recipe"
              rows={3}
            ></textarea>
          </div>

          {/* ── Dietary Tags ── */}
          <div className="form-group">
            <label>Dietary Tags</label>
            <div className="tags-grid">
              {TAG_OPTIONS.map((t) => {
                const active = (formData.dietaryTags || []).includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className={`tag-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleTag(t)}
                    aria-pressed={active}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Numeric metadata row ── */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="servings">Servings</label>
              <input
                type="text"
                id="servings"
                name="servings"
                value={formData.servings}
                onChange={handleChange}
                placeholder="e.g., 4"
                className={errors.servings ? "input-error" : ""}
              />
              {errors.servings && (
                <span className="error-message">{errors.servings}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="prepTime">Prep Time (mins)</label>
              <input
                type="text"
                id="prepTime"
                name="prepTime"
                value={formData.prepTime}
                onChange={handleChange}
                placeholder="e.g., 15"
                className={errors.prepTime ? "input-error" : ""}
              />
              {errors.prepTime && (
                <span className="error-message">{errors.prepTime}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="cookTime">Cook Time (mins)</label>
              <input
                type="text"
                id="cookTime"
                name="cookTime"
                value={formData.cookTime}
                onChange={handleChange}
                placeholder="e.g., 30"
                className={errors.cookTime ? "input-error" : ""}
              />
              {errors.cookTime && (
                <span className="error-message">{errors.cookTime}</span>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="costEstimation">Cost Estimation ($)</label>
              <input
                type="number"
                id="costEstimation"
                name="costEstimation"
                min="0"
                step="0.01"
                value={formData.costEstimation}
                onChange={handleChange}
                placeholder="e.g., 12.50"
              />
            </div>
          </div>

          {/* ── Image section ── */}
          <div className="form-group form-group-image">
            <label>Recipe image</label>
            <div className="image-upload-area">
              {formData.image ? (
                /* Preview the current image and offer a "Remove" button */
                <div className="image-preview-wrap">
                  <img
                    src={formData.image.startsWith("http") ? formData.image : `${API_BASE_URL}${formData.image}`}
                    alt="Recipe"
                    className="image-preview"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="remove-image-btn"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                /* Upload options: file picker and Pexels search */
                <div className="image-upload-options">
                  <label className="image-upload-label">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleImageChange}
                      disabled={isUploadingImage || isFindingImage}
                      className="image-upload-input"
                    />
                    {isUploadingImage ? "Uploading…" : "Choose image (JPEG, PNG, GIF, WebP, max 5MB)"}
                  </label>
                  {/* Only show the Pexels button if title and description are non-empty */}
                  {formData.title.trim() && formData.description.trim() && (
                    <button
                      type="button"
                      onClick={findRelatedImage}
                      disabled={isUploadingImage || isFindingImage}
                      className="find-image-btn"
                    >
                      {isFindingImage ? "Finding image..." : "Find with Pexels"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Ingredients section ── */}
          <div className="form-section">
            <div className="section-header">
              <label>Ingredients</label>
            </div>
            <div className="ingredients-list">
              {formData.ingredients.map((ingredient) => (
                <div key={ingredient.id} className="ingredient-row">
                  {/* Name field */}
                  <input
                    type="text"
                    placeholder="Ingredient name"
                    value={ingredient.name}
                    onChange={(e) =>
                      handleIngredientChange(
                        ingredient.id,
                        "name",
                        e.target.value
                      )
                    }
                    className="ingredient-input"
                  />
                  {/* Amount field */}
                  <input
                    type="text"
                    placeholder="Amount"
                    value={ingredient.amount}
                    onChange={(e) =>
                      handleIngredientChange(
                        ingredient.id,
                        "amount",
                        e.target.value
                      )
                    }
                    className="ingredient-amount"
                  />
                  {/* Unit field */}
                  <input
                    type="text"
                    placeholder="Unit"
                    value={ingredient.unit}
                    onChange={(e) =>
                      handleIngredientChange(
                        ingredient.id,
                        "unit",
                        e.target.value
                      )
                    }
                    className="ingredient-unit"
                  />
                  {/* Remove row button */}
                  <button
                    type="button"
                    onClick={() => removeIngredient(ingredient.id)}
                    className="remove-btn"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addIngredient} className="add-btn">
              + Add Ingredient
            </button>
            {errors.ingredients && (
              <span className="error-message">{errors.ingredients}</span>
            )}
          </div>

          {/* ── Instructions section ── */}
          <div className="form-section">
            <div className="section-header">
              <label>Instructions</label>
            </div>
            <div className="instructions-list">
              {formData.instructions.map((instruction, index) => (
                <div key={instruction.id} className="instruction-row">
                  <span className="step-number">Step {index + 1}</span>
                  <textarea
                    placeholder="Enter instruction"
                    value={instruction.step}
                    onChange={(e) =>
                      handleInstructionChange(instruction.id, e.target.value)
                    }
                    className="instruction-input"
                    rows={2}
                  ></textarea>
                  <button
                    type="button"
                    onClick={() => removeInstruction(instruction.id)}
                    className="remove-btn"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addInstruction} className="add-btn">
              + Add Step
            </button>
            {errors.instructions && (
              <span className="error-message">{errors.instructions}</span>
            )}
          </div>

          {/* ── Form action buttons ── */}
          <div className="form-actions-row">
            {/* Back button only shown in edit mode */}
            {isEditMode && (
              <button
                type="button"
                className="back-btn"
                onClick={() => navigate("/viewRecipes")}
              >
                Back to Recipes
              </button>
            )}
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : isEditMode
                  ? "Update Recipe"
                  : "Save Recipe"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecipeForm;
