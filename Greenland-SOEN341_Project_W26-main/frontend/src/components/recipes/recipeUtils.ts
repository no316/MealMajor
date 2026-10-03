/**
 * @file recipeUtils.ts
 * @description Utility functions and constants for recipe-related components.
 */

import type { Recipe } from "./ViewRecipes";

/** Fallback images used when a recipe has no image. */
export const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80",
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=600&q=80",
  "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=600&q=80",
  "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&q=80",
  "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=600&q=80",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&q=80",
];

/**
 * Simple string hash to consistently pick a fallback image.
 *
 * @param str - The string to hash.
 * @returns A positive integer hash value.
 */
const getHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

/**
 * Returns the image URL for a recipe, falling back to a consistent
 * placeholder image if none is set.
 *
 * @param recipe - The recipe object.
 * @returns The image URL string.
 */
export const getRecipeImage = (recipe: Recipe) =>
  recipe.image || FALLBACK_IMAGES[getHash(recipe.id) % FALLBACK_IMAGES.length];
