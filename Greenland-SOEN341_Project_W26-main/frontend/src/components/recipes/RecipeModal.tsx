import type { Recipe } from "./ViewRecipes";
import { getRecipeImage } from "./recipeUtils";
import "./RecipeModal.css";

interface RecipeModalProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

export default function RecipeModal({
  recipe,
  onClose,
  onEdit,
  onDelete,
  deleting,
}: RecipeModalProps) {
  return (
    <div className="recipe-modal-overlay" onClick={onClose}>
      <div className="recipe-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {/* Hero image */}
        <div className="modal-hero">
          <img
            src={getRecipeImage(recipe)}
            alt={recipe.title}
            className="modal-hero-img"
          />
        </div>
        <div className="recipe-modal-body">
          {/* Edit / Delete actions (top-right) */}
          {(onEdit || onDelete) && (
            <div className="modal-actions-top">
              {onEdit && (
                <button className="modal-action-icon modal-action-edit" onClick={onEdit} title="Edit recipe">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  className="modal-action-icon modal-action-delete"
                  onClick={onDelete}
                  disabled={deleting}
                  title="Delete recipe"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  {deleting ? "..." : "Delete"}
                </button>
              )}
            </div>
          )}

          <h2 className="modal-title">{recipe.title}</h2>
          {recipe.description && (
            <p className="modal-description">{recipe.description}</p>
          )}

          {/* Meta badges */}
          <div className="modal-meta">
            {Number(recipe.prepTime) > 0 && (
              <span className="modal-badge modal-badge-prep">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {recipe.prepTime}m prep
              </span>
            )}
            {Number(recipe.cookTime) > 0 && (
              <span className="modal-badge modal-badge-cook">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {recipe.cookTime}m cook
              </span>
            )}
            {Number(recipe.servings) > 0 && (
              <span className="modal-badge modal-badge-servings">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                {recipe.servings} servings
              </span>
            )}
            {recipe.costEstimation !== undefined && recipe.costEstimation !== null && Number(recipe.costEstimation) > 0 && (
              <span className="modal-badge modal-badge-cost">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                ${Number(recipe.costEstimation).toFixed(2)}
              </span>
            )}
            {recipe.dietaryTags && recipe.dietaryTags.length > 0 && (
              <div style={{ marginLeft: 8 }}>
                {recipe.dietaryTags.map((t) => (
                  <span
                    key={t}
                    className="tag-chip small"
                    style={{ marginRight: 6 }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ingredients list */}
          {(recipe.ingredients && recipe.ingredients.length > 0) && (
            <div className="modal-section">
              <h3>Ingredients</h3>
              <ul className="modal-ingredients-list">
                {recipe.ingredients
                  .filter((ing) => ing.name.trim())
                  .map((ing, idx) => (
                    <li key={idx}>
                      {ing.amount && <strong>{ing.amount} </strong>}
                      {ing.unit && <span>{ing.unit} </span>}
                      {ing.name}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Instructions list */}
          {(recipe.instructions && recipe.instructions.length > 0) && (
            <div className="modal-section">
              <h3>Instructions</h3>
              <ol className="modal-instructions-list">
                {recipe.instructions
                  .filter((inst) => inst.step.trim())
                  .map((inst, idx) => (
                    <li key={idx}>{inst.step}</li>
                  ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
