/**
 * @file gemini.js
 * @description Wrapper module for Google Gemini AI and Pexels image-search integrations.
 *
 * Exports:
 *  - {@link generateMealSuggestion} – calls the Gemini API to generate a personalised
 *    3-course meal suggestion (starter, main course, dessert).
 *  - {@link searchCourseImage}     – searches Pexels for a landscape food photo that
 *    matches a given dish name (and optional description).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Resolve __dirname in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the backend root .env file
dotenv.config({ path: resolve(__dirname, '..', '.env') });

/**
 * Output schema (user-visible fields) for `generateMealSuggestion`.
 *
 * Canonical JSON Schema: `schemas/three-course-meal-output.schema.json`
 *
 * @typedef {Object} ThreeCourseMealOutput
 * @property {{ name: string, description: string, servings: string, prepTime: string, cookTime: string, ingredients: Array, instructions: Array }} starter
 * @property {{ name: string, description: string, servings: string, prepTime: string, cookTime: string, ingredients: Array, instructions: Array }} mainCourse
 * @property {{ name: string, description: string, servings: string, prepTime: string, cookTime: string, ingredients: Array, instructions: Array }} dessert
 */

/**
 * JSON Schema for a single course (starter, main course, or dessert).
 * Used inside the Gemini `responseSchema` to enforce structured output.
 *
 * @type {object}
 */
const courseSchema = {
  type: 'object',
  required: ['name', 'description', 'servings', 'prepTime', 'cookTime', 'ingredients', 'instructions'],
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    servings: { type: 'number' },
    prepTime: { type: 'number' },
    cookTime: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'amount', 'unit'],
        properties: {
          name: { type: 'string' },
          amount: { type: 'string' },
          unit: { type: 'string' },
        },
      },
    },
    instructions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['step'],
        properties: { step: { type: 'string' } },
      },
    },
  },
};

/**
 * Top-level JSON Schema for the Gemini response.
 * Enforces that the model returns exactly `starter`, `mainCourse`, and `dessert`.
 *
 * @type {object}
 */
const responseSchema = {
  type: 'object',
  required: ['starter', 'mainCourse', 'dessert'],
  properties: {
    starter: courseSchema,
    mainCourse: courseSchema,
    dessert: courseSchema,
  },
};

/**
 * Generates a personalised 3-course meal suggestion using the Gemini API.
 *
 * @param {object} params
 * @param {string} [params.dietPreference] - The user's diet preference (e.g. "vegan", "vegetarian").
 * @param {string[]} [params.allergies]    - List of ingredients/foods the user must avoid.
 * @param {string}  params.cuisine        - The cuisine style requested (e.g. "Italian", "Thai").
 * @param {string}  [params.preferenceHints] - Additional free-text preference hints for Gemini.
 *
 * @returns {Promise<{ starter: object, mainCourse: object, dessert: object }>}
 *   Resolves to the three-course meal object returned by Gemini.
 *
 * @throws {Error} If `GEMINI_API_KEY` is not set (`err.code === 'MISSING_API_KEY'`),
 *                 if the API returns non-JSON, or if required course fields are missing.
 */
export async function generateMealSuggestion({ dietPreference, allergies, cuisine, preferenceHints }) {
  // Validate that the Gemini API key is configured
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY environment variable is not set.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // Initialise the Gemini client and select the model with strict JSON output
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  });

  // Build diet restriction line for the prompt
  const dietLine = dietPreference && dietPreference !== 'none'
    ? `The user follows a ${dietPreference} diet.`
    : 'The user has no specific diet restriction.';

  // Build allergy restriction line for the prompt
  const allergyLine = Array.isArray(allergies) && allergies.length > 0
    ? `The user is allergic to or must avoid: ${allergies.join(', ')}.`
    : 'The user has no known food allergies.';

  // Optionally include extra preference hints
  const preferenceLine = preferenceHints && preferenceHints.trim()
    ? `Additional preferences: ${preferenceHints}`
    : '';

  // Compose the prompt sent to Gemini
  const prompt = `
You are a professional chef and recipe developer. Suggest a 3-course ${cuisine} meal for a diner with the following constraints:
- ${dietLine}
- ${allergyLine}
${preferenceLine ? `- ${preferenceLine}` : ''}

Generate a complete 3-course meal with detailed recipes for each course. Each course should be a full recipe with ingredients and step-by-step instructions.
`.trim();

  // Request the meal suggestion from Gemini
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Parse and validate the JSON response
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Unexpected non-JSON response from Gemini: ${text.slice(0, 200)}`);
  }

  const { starter, mainCourse, dessert } = parsed;
  if (!starter || !mainCourse || !dessert) {
    throw new Error('Gemini response is missing one or more course fields.');
  }

  /**
   * Validates that all required fields exist in a course object.
   *
   * @param {object} course     - The course object to validate.
   * @param {string} courseName - Human-readable course name for error messages.
   * @throws {Error} If a required field is null, undefined, or empty string.
   */
  const validateCourse = (course, courseName) => {
    const required = ['name', 'description', 'servings', 'prepTime', 'cookTime', 'ingredients', 'instructions'];
    for (const field of required) {
      if (course[field] == null || course[field] === '') {
        throw new Error(`${courseName} is missing required field: ${field}`);
      }
    }
  };

  // Validate each course before returning
  validateCourse(starter, 'Starter');
  validateCourse(mainCourse, 'Main Course');
  validateCourse(dessert, 'Dessert');

  return { starter, mainCourse, dessert };
}

/**
 * Searches for a food photo on Pexels matching the given dish.
 *
 * Strategy:
 *  1. Search using `"${dishName} ${dishDescription} food dish"`.
 *  2. If no results are found and a description was provided, fall back to
 *     searching with just `"${dishName} food dish"`.
 *
 * @param {object} params
 * @param {string} params.dishName        - The name of the dish to search for.
 * @param {string} [params.dishDescription] - Optional description to refine the search.
 * @returns {Promise<{ imageUrl: string }>} The URL of the first landscape photo found.
 * @throws {Error} If `PEXELS_API` is not set, the API returns an error, or no photos are found.
 */
export async function searchCourseImage({ dishName, dishDescription }) {
  // Validate that the Pexels API key is configured
  const apiKey = process.env.PEXELS_API;
  if (!apiKey) {
    const err = new Error('PEXELS_API environment variable is not set.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // Build the initial query string; include description if available for better results
  let queryText = dishName;
  if (dishDescription) {
    queryText = `${dishName} ${dishDescription}`;
  }

  // Encode query and request the first landscape result from Pexels
  let query = encodeURIComponent(`${queryText} food dish`);
  let response = await fetch(
    `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
    { headers: { Authorization: apiKey } },
  );

  if (!response.ok) {
    throw new Error(`Pexels API returned status ${response.status}`);
  }

  let data = await response.json();

  // Fallback: if description-based query returns no results, retry with name only
  if ((!data.photos || data.photos.length === 0) && dishDescription) {
    query = encodeURIComponent(`${dishName} food dish`);
    response = await fetch(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      { headers: { Authorization: apiKey } },
    );

    if (response.ok) {
      data = await response.json();
    }
  }

  // Throw a descriptive error if no photos were found after both attempts
  if (!data.photos || data.photos.length === 0) {
    throw new Error(`No Pexels photos found for "${dishName}".`);
  }

  // Return the "large" size URL of the first photo
  return { imageUrl: data.photos[0].src.large };
}
