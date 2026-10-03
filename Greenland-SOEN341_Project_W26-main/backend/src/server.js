/**
 * @file server.js
 * @description Express REST API server for the MealMajor application.
 *
 * Storage strategy: all data is persisted as JSON files in the `data/` directory
 * rather than a database.  This keeps the project dependency-light but means
 * every mutation requires a full read-modify-write cycle.
 *
 * Key responsibilities:
 *  - Authentication  (`POST /api/register`, `POST /api/login`)
 *  - User profiles   (`GET /api/profile/:id`, `PATCH /api/profile/:id`)
 *  - Recipes         (`GET|POST /api/recipes`, `GET|PUT|DELETE /api/recipes/:id`,
 *                     `POST /api/recipes/upload`)
 *  - Meal plans      (`GET|POST /api/mealplans`, `GET|PUT|DELETE /api/mealplans/:id`,
 *                     `PATCH /api/mealplans/:id/slot`)
 *  - Gemini AI       (`POST /api/gemini/meal-suggestion`,
 *                     `POST /api/gemini/generate-image`)
 *
 * Environment variables (`.env`):
 *  - `JWT_SECRET`  – secret used to sign/verify JWTs (required in production).
 *  - `GEMINI_API_KEY` – Google Gemini API key.
 *  - `PEXELS_API`  – Pexels API key for food image search.
 */
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMealSuggestion, searchCourseImage } from './gemini.js';
import { jsonrepair } from 'jsonrepair';

// Resolve __dirname in an ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Project root directory (one level above `src/`). */
const ROOT_DIR = path.resolve(__dirname, '..');

const app = express();
/** Express server port. */
const PORT = 3001;
/** Path to the JSON file used for user records. */
const USERS_FILE = path.join(ROOT_DIR, 'data', 'users.json');
/** Directory where recipe images are stored after upload. */
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
/** JWT signing secret. Falls back to a dev-only value when `JWT_SECRET` is not set. */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

/** Path to the JSON file used for recipe records. */
const RECIPES_FILE = path.join(ROOT_DIR, 'data', 'recipes.json');
/** Path to the JSON file used for meal-plan records. */
const MEALPLANS_FILE = path.join(ROOT_DIR, 'data', 'mealplans.json');
/** Path to the JSON file used to cache Gemini suggestion records. */
const GEMINI_SUGGESTIONS_FILE = path.join(ROOT_DIR, 'data', 'gemini_suggestions.json');

// ── Multer configuration for recipe image uploads ────────────────────────────

/**
 * Multer disk-storage engine.
 * - `destination`: creates `UPLOADS_DIR` if it doesn't exist, then saves files there.
 * - `filename`: generates a collision-resistant name using a timestamp + random suffix.
 */
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, name);
  },
});

/**
 * Configured Multer middleware.
 * - Max file size: 5 MB.
 * - Accepted MIME types: JPEG, PNG, GIF, WebP.
 */
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, allowed);
  },
});

// ── Recipe file helpers ───────────────────────────────────────────────────────

/**
 * Ensures `RECIPES_FILE` exists.  Creates an empty array JSON file if not.
 * Called once during server startup via {@link initializeDataFile}.
 */
async function initializeRecipesFile() {
  await fs.mkdir(path.join(ROOT_DIR, 'data'), { recursive: true });
  try {
    await fs.access(RECIPES_FILE);
  } catch {
    await fs.writeFile(RECIPES_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Reads and parses all recipes from disk.
 * Uses `jsonrepair` as a fallback when the file is slightly malformed
 * (e.g. trailing commas introduced by a crash mid-write).
 *
 * @returns {Promise<object[]>} Array of recipe objects.
 * @throws {Error} If the file cannot be read or repaired.
 */
async function readRecipes() {
  let data;
  try {
    data = await fs.readFile(RECIPES_FILE, 'utf8');
    return JSON.parse(data);
   } catch (error) {
     if (error instanceof SyntaxError) {
       const repaired = jsonrepair(data);
       return JSON.parse(repaired);
     }
     throw error;
   }
}

/**
 * Writes the given recipes array to disk (full overwrite, pretty-printed).
 *
 * @param {object[]} recipes - The complete array of recipe objects to persist.
 */
async function writeRecipes(recipes) {
  await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
}

// ── Meal plan file helpers ────────────────────────────────────────────────────

/**
 * Ensures `MEALPLANS_FILE` exists.  Creates an empty array JSON file if not.
 */
async function initializeMealPlansFile() {
  await fs.mkdir(path.join(ROOT_DIR, 'data'), { recursive: true });
  try {
    await fs.access(MEALPLANS_FILE);
  } catch {
    await fs.writeFile(MEALPLANS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Reads and parses all meal plans from disk.
 * Corrupted files are silently reset to an empty array.
 *
 * @returns {Promise<object[]>} Array of meal plan objects.
 */
async function readMealPlans() {
  try {
    const data = await fs.readFile(MEALPLANS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If file is corrupted, reinitialize it
      await fs.writeFile(MEALPLANS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    throw error;
  }
}

/**
 * Writes the given meal plans array to disk (full overwrite, pretty-printed).
 *
 * @param {object[]} mealPlans - The complete array of meal plan objects to persist.
 */
async function writeMealPlans(mealPlans) {
  await fs.writeFile(MEALPLANS_FILE, JSON.stringify(mealPlans, null, 2));
}

export { initializeMealPlansFile };

// ── Gemini suggestion cache helpers ──────────────────────────────────────────

/**
 * Ensures `GEMINI_SUGGESTIONS_FILE` exists.  Creates an empty array JSON file if not.
 */
async function initializeGeminiSuggestionsFile() {
  await fs.mkdir(path.join(ROOT_DIR, 'data'), { recursive: true });
  try {
    await fs.access(GEMINI_SUGGESTIONS_FILE);
  } catch {
    await fs.writeFile(GEMINI_SUGGESTIONS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Reads and parses cached Gemini suggestion records from disk.
 * Corrupted files are silently reset to an empty array.
 *
 * @returns {Promise<object[]>} Array of cached suggestion records.
 */
async function readGeminiSuggestions() {
  try {
    const data = await fs.readFile(GEMINI_SUGGESTIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If file is corrupted, reinitialize it
      await fs.writeFile(GEMINI_SUGGESTIONS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    throw error;
  }
}

/**
 * Writes Gemini suggestion records to disk (full overwrite, pretty-printed).
 *
 * @param {object[]} records - The complete array of suggestion records to persist.
 */
async function writeGeminiSuggestions(records) {
  await fs.writeFile(GEMINI_SUGGESTIONS_FILE, JSON.stringify(records, null, 2));
}

const VALID_DAY_KEYS = new Set([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

// Allowed meal slots for each day in a meal plan.
// Each day can optionally specify one or more of these slots as strings.
const VALID_MEAL_SLOTS = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
]);

/**
 * Validates the optional `days` field of a meal plan payload.
 * Rules:
 *  - If present, must be a plain object (not array, not null).
 *  - All keys must be one of the seven day names.
 *  - All values must be either:
 *      - a string (legacy format: single meal per day), or
 *      - an object mapping meal slots (breakfast, lunch, dinner, snack)
 *        to string values.
 * Returns { ok, errors }.
 */
function validateDays(days) {
  if (days === undefined || days === null) return { ok: true, errors: {} };
  const errors = {};

  if (typeof days !== 'object' || Array.isArray(days)) {
    errors.days = 'days must be a plain object mapping day names to meal strings.';
    return { ok: false, errors };
  }

  const invalidKeys = Object.keys(days).filter((k) => !VALID_DAY_KEYS.has(k));
  if (invalidKeys.length > 0) {
    errors.days = `days contains invalid day keys: ${invalidKeys.join(', ')}. Allowed keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday.`;
    return { ok: false, errors };
  }

  // Per-day validation: allow string (legacy) OR object of meal slots.
  for (const [dayKey, value] of Object.entries(days)) {
    if (typeof value === 'string' || value === undefined || value === null) {
      // Legacy or empty – already covered by earlier behavior.
      continue;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.days = `Value for day "${dayKey}" must be a string or an object of meal slots.`;
      return { ok: false, errors };
    }

    const slotKeys = Object.keys(value);
    const invalidSlots = slotKeys.filter((slot) => !VALID_MEAL_SLOTS.has(slot));
    if (invalidSlots.length > 0) {
      errors.days = `Day "${dayKey}" contains invalid meal slots: ${invalidSlots.join(', ')}. Allowed slots: breakfast, lunch, dinner, snack.`;
      return { ok: false, errors };
    }

    const nonStringSlots = Object.entries(value).filter(([, v]) => typeof v !== 'string');
    if (nonStringSlots.length > 0) {
      errors.days = `All meal slot values for day "${dayKey}" must be strings.`;
      return { ok: false, errors };
    }
  }

  return { ok: true, errors: {} };
}

/**
 * Normalises a single day's value from the meal plan storage into the
 * canonical four-slot format: `{ breakfast, lunch, dinner, snack }`.
 *
 * Handles two historic shapes:
 *  - `null`/`undefined` → all slots empty.
 *  - `string` (legacy) → treated as the `dinner` value.
 *  - `object` (current) → each slot coerced to a string.
 *
 * @param {string|object|null|undefined} dayValue - Raw value read from storage.
 * @returns {{ breakfast: string, lunch: string, dinner: string, snack: string }}
 */
function normalizePlanDaySlots(dayValue) {
  if (dayValue == null || typeof dayValue === 'string') {
    return {
      breakfast: '',
      lunch: '',
      dinner: typeof dayValue === 'string' ? dayValue : '',
      snack: '',
    };
  }
  if (typeof dayValue === 'object' && !Array.isArray(dayValue)) {
    return {
      breakfast: String(dayValue.breakfast ?? ''),
      lunch: String(dayValue.lunch ?? ''),
      dinner: String(dayValue.dinner ?? ''),
      snack: String(dayValue.snack ?? ''),
    };
  }
  return { breakfast: '', lunch: '', dinner: '', snack: '' };
}

/**
 * Expands a sparse `days` object (which may be missing some day keys) into
 * the full seven-day canonical structure by normalising every day's slots.
 *
 * @param {object|null|undefined} days - The raw `days` field from a meal plan record.
 * @returns {object} A fully-populated object with all seven days normalised.
 */
function expandDaysFromPlan(days) {
  const out = {};
  for (const dayKey of VALID_DAY_KEYS) {
    out[dayKey] = normalizePlanDaySlots(days?.[dayKey]);
  }
  return out;
}

/**
 * Checks whether a recipe (identified by its title or ID string) is already
 * assigned to any slot in the week's meal plan, excluding the slot currently
 * being updated.
 *
 * Used to enforce the one-recipe-per-week business rule.
 *
 * @param {object} days       - The full expanded days object of the meal plan.
 * @param {string} recipeId   - The recipe title/ID string being assigned.
 * @param {string} currentDay - The day key of the slot being updated (excluded from check).
 * @param {string} currentMeal - The meal-type of the slot being updated (excluded from check).
 * @returns {boolean} `true` if the recipe is already present in a different slot.
 */
function isDuplicateMealAssignment(days, recipeId, currentDay, currentMeal) {
  const normalizedRecipeId = String(recipeId ?? '').trim().toLowerCase();

  // Empty value means clearing a slot, so not a duplicate
  if (!normalizedRecipeId) {
    return false;
  }

  for (const [dayKey, meals] of Object.entries(days || {})) {
    if (!meals || typeof meals !== 'object') continue;

    for (const [mealKey, assignedRecipeId] of Object.entries(meals)) {
      // Ignore the slot currently being edited
      if (dayKey === currentDay && mealKey === currentMeal) {
        continue;
      }

      if (String(assignedRecipeId ?? '').trim().toLowerCase() === normalizedRecipeId) {
        return true;
      }
    }
  }

  return false;
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

/**
 * Master data initialiser — called once at server startup.
 *
 * Ensures every JSON data file exists with a valid empty-array default,
 * so routes never encounter a missing-file error on first run.
 *
 * @returns {Promise<void>}
 */
export async function initializeDataFile() {
  await fs.mkdir(path.join(ROOT_DIR, 'data'), { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
  }
  await initializeRecipesFile();
  await initializeMealPlansFile();
  await initializeGeminiSuggestionsFile();
}

// ── User file helpers ─────────────────────────────────────────────────────────

/**
 * Reads and parses all user records from disk.
 * Corrupted files are silently reset to an empty array.
 *
 * @returns {Promise<object[]>} Array of user objects.
 */
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error instanceof SyntaxError) {
      // If file is corrupted, reinitialize it
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    throw error;
  }
}

/**
 * Writes the given users array to disk (full overwrite, pretty-printed).
 *
 * @param {object[]} users - The complete array of user objects to persist.
 */
async function writeUsers(users) {
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

/**
 * Returns `true` if `email` matches the basic `a@b.c` pattern.
 *
 * @param {string} email - The email string to test.
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Express middleware that validates a Bearer JWT and attaches the decoded
 * payload to `req.user`.
 *
 * Responds with:
 *  - `401 Access token required` – if no `Authorization` header is present.
 *  - `403 Token expired`         – if the token's `exp` claim has passed.
 *  - `401 Invalid token`         – if the signature or structure is invalid.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach decoded user payload to the request object
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expired'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
}

// ── Recipe validation helpers ─────────────────────────────────────────────────

/**
 * Returns `true` if `v` is a non-empty string (after trimming whitespace).
 *
 * @param {*} v - Any value.
 * @returns {boolean}
 */
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Coerces an array to a string array, trimming each element and removing
 * blank entries.
 *
 * @param {Array} arr - Array of values to normalise.
 * @returns {string[]} Filtered array of non-empty trimmed strings.
 */
function normalizeStringArray(arr) {
  return arr
      .map(x => (typeof x === 'string' ? x.trim() : ''))
      .filter(x => x.length > 0);
}

/**
 * Validates and normalizes the incoming recipe payload.
 * Accepts:
 *  - title OR name
 *  - steps OR instructions
 *  - ingredients as array of strings OR array of { name, quantity?, unit?, notes? }
 */
function validateRecipePayload(body) {
  const errors = {};

  const userId = body.userId;
  const title = body.title ?? body.name;
  const description = body.description ?? '';
  const ingredients = body.ingredients;
  const instructions = body.instructions;

  const prepTime = body.prepTime;
  const cookTime = body.cookTime;
  const servings = body.servings;

  if (!isNonEmptyString(userId)) errors.userId = 'userId is required.';

  if (!isNonEmptyString(title)) {
    errors.title = 'title is required.';
  } else if (title.trim().length > 100) {
    errors.title = 'title must be at most 100 characters.';
  }

  if (typeof description !== 'string') {
    errors.description = 'description must be a string.';
  } else if (description.length > 1000) {
    errors.description = 'description must be at most 1000 characters.';
  }

  // Ingredients: non-empty array of objects with name field
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    errors.ingredients = 'ingredients must be a non-empty array.';
  } else {
    const hasValidIngredient = ingredients.some(x => x && typeof x === 'object' && isNonEmptyString(x.name));
    if (!hasValidIngredient) {
      errors.ingredients = 'ingredients must contain at least one item with a non-empty name.';
    }
  }

  // Instructions: non-empty array of objects with step field
  if (!Array.isArray(instructions) || instructions.length === 0) {
    errors.instructions = 'instructions must be a non-empty array.';
  } else {
    const hasValidStep = instructions.some(x => x && typeof x === 'object' && isNonEmptyString(x.step));
    if (!hasValidStep) {
      errors.instructions = 'instructions must contain at least one non-empty step.';
    }
  }

  // Optional numeric checks
  if (prepTime !== undefined && prepTime !== '') {
    const n = Number(prepTime);
    if (!Number.isFinite(n) || n < 0) errors.prepTime = 'prepTime must be a number >= 0.';
  }
  if (cookTime !== undefined && cookTime !== '') {
    const n = Number(cookTime);
    if (!Number.isFinite(n) || n < 0) errors.cookTime = 'cookTime must be a number >= 0.';
  }
  if (servings !== undefined && servings !== '') {
    const n = Number(servings);
    if (!Number.isFinite(n) || n <= 0) errors.servings = 'servings must be a number > 0.';
  }

  const ok = Object.keys(errors).length === 0;

  const normalized = {
    userId: isNonEmptyString(userId) ? userId.trim() : userId,
    title: isNonEmptyString(title) ? title.trim() : title,
    description: typeof description === 'string' ? description.trim() : description,
    ingredients,
    instructions,
    prepTime: prepTime === undefined || prepTime === '' ? undefined : Number(prepTime),
    cookTime: cookTime === undefined || cookTime === '' ? undefined : Number(cookTime),
    servings: servings === undefined || servings === '' ? undefined : Number(servings),
    image: typeof body.image === 'string' ? body.image.trim() : '',
    dietaryTags: undefined,
    costEstimation: undefined,
  };

  // Dietary tags: optional array of strings
  if (body.dietaryTags !== undefined) {
    if (!Array.isArray(body.dietaryTags)) {
      errors.dietaryTags = 'dietaryTags must be an array of strings.';
    } else {
      const tags = normalizeStringArray(body.dietaryTags);
      // enforce reasonable limits
      if (tags.some(t => t.length > 50)) {
        errors.dietaryTags = 'each dietary tag must be at most 50 characters.';
      } else {
        normalized.dietaryTags = tags;
      }
    }
  }

  // Cost estimation: optional numeric >= 0
  if (body.costEstimation !== undefined && body.costEstimation !== '') {
    const n = Number(body.costEstimation);
    if (!Number.isFinite(n) || n < 0) {
      errors.costEstimation = 'costEstimation must be a number >= 0.';
    } else {
      normalized.costEstimation = n;
    }
  }
  return { ok, errors, normalized };
}




// ── Auth routes ───────────────────────────────────────────────────────────────

/**
 * @route  POST /api/register
 * @desc   Create a new user account.
 * @body   {{ firstName: string, lastName: string, email: string, password: string }}
 * @access Public
 *
 * Validates all required fields, enforces a minimum password length of 8 chars,
 * checks for duplicate emails, and persists the new user.
 * The password is stored in plain text – this is acceptable for a demo project
 * but MUST be replaced with bcrypt hashing in production.
 *
 * @returns {200} `{ success, message, user }`
 * @returns {400} Validation error (missing or invalid field).
 * @returns {409} Email already registered.
 * @returns {500} Unexpected server error.
 */
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Validate required fields
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'First name is required'
      });
    }

    if (!lastName || !lastName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Last name is required'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const users = await readUsers();

    // Check for duplicate email
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    const newUser = {
      id: Date.now().toString(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      registeredAt: new Date().toISOString()
    };

    users.push(newUser);
    await writeUsers(users);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: { id: newUser.id, firstName: newUser.firstName, lastName: newUser.lastName, email: newUser.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.'
    });
  }
});

/**
 * @route  POST /api/login
 * @desc   Authenticate an existing user and return a signed JWT.
 * @body   {{ email: string, password: string }}
 * @access Public
 *
 * Looks up the user by email (case-insensitive) and compares the password.
 * On success, returns a 24-hour JWT and the public user fields.
 *
 * @returns {200} `{ success, message, token, user }`
 * @returns {400} Missing or invalid input.
 * @returns {401} Email not found or wrong password.
 * @returns {500} Unexpected server error.
 */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const users = await readUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user || user.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        dietPreference: user.dietPreference ?? null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login. Please try again.'
    });
  }
});


// ── Profile routes ──────────────────────────────────────────────────────────────

/**
 * @route  GET /api/profile/:id
 * @desc   Fetch the public profile for a user (password excluded).
 * @param  {string} id - The user's UUID.
 * @access Public (authentication recommended in future)
 *
 * @returns {200} `{ success, user }` – user object without the `password` field.
 * @returns {400} Missing user ID.
 * @returns {404} User not found.
 * @returns {500} Unexpected server error.
 */
// Get user profile by ID
app.get('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const users = await readUsers();
    const user = users.find(u => u.id === id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user data without password
    const { password: _password, ...userWithoutPassword } = user;

    return res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching profile. Please try again.'
    });
  }
});

/**
 * @route  PATCH /api/profile/:id
 * @desc   Update mutable profile fields for a user.
 * @param  {string} id - The user's UUID.
 * @body   {{ allergies?: string[], dietPreference?: string }}
 * @access Public (authentication recommended in future)
 *
 * Only the fields present in the request body are updated.
 * Returns the updated user object (password excluded).
 *
 * @returns {200} `{ success, user }`
 * @returns {400} Missing user ID.
 * @returns {404} User not found.
 * @returns {500} Unexpected server error.
 */
app.patch('/api/profile/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { allergies, dietPreference } = req.body;



    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user fields
    if (allergies !== undefined) {
      users[userIndex].allergies = Array.isArray(allergies) ? allergies : [];
    }
    if (dietPreference !== undefined) {
      users[userIndex].dietPreference = dietPreference;
    }

    // Write updated users back to file
    await writeUsers(users);

    // Return updated user without password
    const { password: _password, ...userWithoutPassword } = users[userIndex];
    return res.status(200).json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while updating profile. Please try again.'
    });
  }
});

// ── Gemini / AI routes ───────────────────────────────────────────────────────────

/**
 * @route  POST /api/gemini/meal-suggestion
 * @desc   Generate a personalised 3-course meal suggestion via Google Gemini.
 * @body   {{
 *   userId?: string,
 *   cuisine: string,
 *   dietPreference?: string,
 *   allergies?: string[],
 *   starterPreference?: string,
 *   mainPreference?: string,
 *   dessertPreference?: string,
 *   servings?: string,
 *   budget?: string,
 *   prepTime?: string,
 *   spiceLevel?: string
 * }}
 * @access Public
 *
 * If `userId` is provided, the user's stored `dietPreference` and `allergies`
 * are used as defaults (can be overridden by body fields).
 * The generated suggestion is cached to `GEMINI_SUGGESTIONS_FILE`.
 *
 * @returns {200} `{ success, suggestion }` – the 3-course meal object.
 * @returns {400} Missing or invalid `cuisine`.
 * @returns {500} Gemini API error or unexpected server error.
 */
app.post('/api/gemini/meal-suggestion', async (req, res) => {
  try {
    const { 
      userId, 
      cuisine, 
      dietPreference: dietPrefOverride, 
      allergies: allergiesOverride,
      starterPreference,
      mainPreference,
      dessertPreference
    } = req.body ?? {};

    if (typeof cuisine !== 'string' || cuisine.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'cuisine is required and must be a non-empty string',
      });
    }

    let dietPreference = dietPrefOverride;
    let allergies = allergiesOverride;

    if (userId) {
      const users = await readUsers();
      const user = users.find((u) => String(u.id) === String(userId));

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found for provided userId',
        });
      }

      if (dietPreference === undefined) {
        dietPreference = user.dietPreference ?? 'none';
      }
      if (allergies === undefined) {
        allergies = Array.isArray(user.allergies) ? user.allergies : [];
      }
    }

    if (allergies !== undefined && !Array.isArray(allergies)) {
      return res.status(400).json({
        success: false,
        message: 'allergies must be an array of strings when provided',
      });
    }

    // Build preference string for Gemini
    const preferenceHints = [];
    if (starterPreference) preferenceHints.push(`The user prefers ${starterPreference} starters.`);
    if (mainPreference) preferenceHints.push(`For the main course, the user prefers ${mainPreference} dishes.`);
    if (dessertPreference) preferenceHints.push(`For dessert, the user prefers ${dessertPreference} options.`);
    
    const suggestion = await generateMealSuggestion({
      dietPreference,
      allergies: Array.isArray(allergies) ? allergies : [],
      cuisine: cuisine.trim(),
      preferenceHints: preferenceHints.join(' '),
    });

    await initializeGeminiSuggestionsFile();
    const records = await readGeminiSuggestions();

    const record = {
      id: Date.now().toString(),
      userId: userId ?? null,
      dietPreference: dietPreference ?? null,
      allergies: Array.isArray(allergies) ? allergies : [],
      cuisine: cuisine.trim(),
      starterPreference: starterPreference || null,
      mainPreference: mainPreference || null,
      dessertPreference: dessertPreference || null,
      suggestion,
      createdAt: new Date().toISOString(),
    };

    records.push(record);
    await writeGeminiSuggestions(records);

    return res.status(200).json({
      success: true,
      suggestion: record.suggestion,
      context: {
        id: record.id,
        userId: record.userId,
        dietPreference: record.dietPreference,
        allergies: record.allergies,
        cuisine: record.cuisine,
        createdAt: record.createdAt,
      },
    });
  } catch (error) {
    console.error('Gemini meal suggestion error:', error);

    if (error && error.code === 'MISSING_API_KEY') {
      return res.status(500).json({
        success: false,
        message: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred while generating the meal suggestion. Please try again.'
    });
  }
});

/**
 * @route  POST /api/gemini/generate-image
 * @desc   Search for a food photograph on Pexels matching a dish name.
 * @body   {{ dishName: string, dishDescription?: string }}
 * @access Public
 *
 * Calls {@link searchCourseImage} and returns the first landscape photo URL.
 *
 * @returns {200} `{ success, imageUrl }`
 * @returns {400} Missing or empty `dishName`.
 * @returns {500} Pexels API error or no results found.
 */
// Search for a food photo on Pexels for a given dish
app.post('/api/gemini/generate-image', async (req, res) => {
  try {
    const { dishName, dishDescription } = req.body;

    if (!dishName || typeof dishName !== 'string' || !dishName.trim()) {
      return res.status(400).json({ message: 'dishName is required.' });
    }

    const { imageUrl } = await searchCourseImage({ 
      dishName: dishName.trim(), 
      dishDescription: dishDescription?.trim() 
    });

    return res.json({ success: true, imageUrl });
  } catch (err) {
    console.error('Image search error:', err);
    return res.status(500).json({ message: 'Failed to find image.' });
  }
});

/**
 * @route  GET /api/gemini/meal-suggestions
 * @desc   List cached Gemini meal suggestion records.
 * @query  {string} [userId] - Optional filter to get only this user's suggestions.
 * @access Public
 *
 * @returns {200} `{ success, count, records }`
 * @returns {500} Unexpected server error.
 */
// Optional: fetch stored Gemini suggestions (optionally filtered by userId)
app.get('/api/gemini/meal-suggestions', async (req, res) => {
  try {
    await initializeGeminiSuggestionsFile();
    const { userId } = req.query;
    let records = await readGeminiSuggestions();

    if (userId) {
      records = records.filter((r) => String(r.userId) === String(userId));
    }

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Gemini suggestions fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching Gemini suggestions. Please try again.'
    });
  }
});


// ── Recipe routes ───────────────────────────────────────────────────────────────

/**
 * @route  POST /api/recipes/upload
 * @desc   Upload a recipe image and return its publicly accessible URL.
 * @access Public
 *
 * Accepts a single `image` file via `multipart/form-data`.
 * The file is stored in `UPLOADS_DIR` and served at `/uploads/<filename>`.
 *
 * @returns {200} `{ success, url }` – the full URL to the uploaded file.
 * @returns {400} No file was included in the request.
 * @returns {500} File system error during upload.
 */
// Upload recipe image (must be before /api/recipes/:id)
app.post('/api/recipes/upload', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
    }
    const url = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    return res.status(200).json({
      success: true,
      url,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image.',
    });
  }
});

// ── Meal plan routes ──────────────────────────────────────────────────────────────

/**
 * @route  POST /api/mealplans
 * @desc   Create a new weekly meal plan for a user.
 * @body   {{ userId: string, weekId: string, days?: object }}
 * @access Public
 *
 * Enforces a uniqueness constraint: one plan per user per ISO week.
 *
 * @returns {201} `{ success, message, mealPlan }`
 * @returns {400} Missing/invalid fields or invalid day structure.
 * @returns {409} A plan already exists for this user+week.
 * @returns {500} Unexpected server error.
 */
// Create weekly meal plan (basic persist)
app.post('/api/mealplans', async (req, res) => {
  try {
    const { userId, weekId, days } = req.body ?? {};
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }
    if (typeof weekId !== 'string' || weekId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'weekId is required',
      });
    }

    // Validate days field if provided
    const daysValidation = validateDays(days);
    if (!daysValidation.ok) {
      return res.status(400).json({
        success: false,
        message: daysValidation.errors.days,
      });
    }

    const mealPlans = await readMealPlans();
    const normalizedUserId = userId.trim();
    const normalizedWeekId = weekId.trim();

    // Enforce one meal plan per user per week
    const existingPlan = mealPlans.find(
      (plan) => plan.userId === normalizedUserId && plan.weekId === normalizedWeekId
    );

    if (existingPlan) {
      return res.status(409).json({
        success: false,
        message: 'A meal plan for this week already exists for this user.',
      });
    }

    const newPlan = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...req.body,
      userId: normalizedUserId,
      weekId: normalizedWeekId,
    };

    mealPlans.push(newPlan);
    await writeMealPlans(mealPlans);

    return res.status(201).json({
      success: true,
      message: 'Meal plan created successfully',
      mealPlan: newPlan,
    });
  } catch (error) {
    console.error('Meal plan create error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating the meal plan. Please try again.'
    });
  }
});

/**
 * @route  GET /api/mealplans
 * @desc   List meal plans, optionally filtered by `userId` and/or `weekId`.
 * @query  {string} [userId]  - Filter by owning user ID.
 * @query  {string} [weekId]  - Filter by ISO week identifier (e.g. `"2025-W03"`).
 * @access Public
 *
 * @returns {200} `{ success, count, mealPlans }`
 * @returns {400} Invalid query parameters.
 * @returns {500} Unexpected server error.
 */
// Get meal plans (optionally filtered by userId and/or weekId)
app.get('/api/mealplans', async (req, res) => {
  try {
    const { userId, weekId } = req.query;

    let mealPlans = await readMealPlans();

    if (userId) {
      const uid = String(userId).trim();
      if (!uid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId parameter',
        });
      }
      mealPlans = mealPlans.filter((plan) => String(plan.userId) === uid);
    }

    if (weekId) {
      const wid = String(weekId).trim();
      if (!wid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid weekId parameter',
        });
      }
      mealPlans = mealPlans.filter((plan) => String(plan.weekId) === wid);
    }

    return res.status(200).json({
      success: true,
      count: mealPlans.length,
      mealPlans,
    });
  } catch (error) {
    console.error('Meal plan fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching meal plans. Please try again.'
    });
  }
});

/**
 * @route  PUT /api/mealplans/:id
 * @desc   Fully update an existing meal plan.
 * @param  {string} id - The plan's ID.
 * @body   {{ userId?: string, weekId?: string, days?: object, ... }}
 * @access Public
 *
 * Preserves `id`, `userId`, and `weekId` from the existing record to prevent
 * unintended ownership changes.
 *
 * @returns {200} `{ success, message, mealPlan }`
 * @returns {400} Invalid day structure.
 * @returns {404} Meal plan not found.
 * @returns {500} Unexpected server error.
 */
// Update an existing meal plan by id
app.put('/api/mealplans/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate days field if provided in the update payload
    const daysValidation = validateDays(req.body?.days);
    if (!daysValidation.ok) {
      return res.status(400).json({
        success: false,
        message: daysValidation.errors.days,
      });
    }

    const mealPlans = await readMealPlans();
    const index = mealPlans.findIndex((plan) => String(plan.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found',
      });
    }

    const current = mealPlans[index];
    const updatedPlan = {
      ...current,
      ...req.body,
      id: current.id,
      userId: current.userId,
      weekId: current.weekId,
      updatedAt: new Date().toISOString(),
    };

    mealPlans[index] = updatedPlan;
    await writeMealPlans(mealPlans);

    return res.status(200).json({
      success: true,
      message: 'Meal plan updated successfully',
      mealPlan: updatedPlan,
    });
  } catch (error) {
    console.error('Meal plan update error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the meal plan. Please try again.'
    });
  }
});

/**
 * @route  PATCH /api/mealplans/:id/slot
 * @desc   Update a single meal slot in an existing plan (atomic partial update).
 * @param  {string} id    - The plan's ID.
 * @body   {{ day: DayKey, meal: MealTimeKey, value: string }}
 * @access Public
 *
 * Enforces the duplicate-recipe-per-week rule:
 * a recipe name cannot appear more than once in the same week plan.
 * Pass an empty string as `value` to clear the slot.
 *
 * @returns {200} `{ success, message, mealPlan }`
 * @returns {400} Invalid `day`, `meal`, or `value`; or duplicate assignment.
 * @returns {404} Meal plan not found.
 * @returns {500} Unexpected server error.
 */
// Update a single day/meal slot on a meal plan (partial update)
app.patch('/api/mealplans/:id/slot', async (req, res) => {
  try {
    const { id } = req.params;
    const { day, meal, value } = req.body ?? {};

    if (typeof day !== 'string' || !VALID_DAY_KEYS.has(day)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing day. Use monday..sunday.',
      });
    }
    if (typeof meal !== 'string' || !VALID_MEAL_SLOTS.has(meal)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing meal slot. Use breakfast, lunch, dinner, or snack.',
      });
    }
    if (typeof value !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'value must be a string (use empty string to clear the slot).',
      });
    }

    const mealPlans = await readMealPlans();
    const index = mealPlans.findIndex((plan) => String(plan.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found',
      });
    }

    const current = mealPlans[index];
    const expanded = expandDaysFromPlan(current.days);

    //  Prevent duplicate recipe assignment in the same week
    if (isDuplicateMealAssignment(expanded, value, day, meal)) {
      return res.status(400).json({
        success: false,
        message: 'This recipe is already assigned in this week.'
      });
    }

    expanded[day] = { ...expanded[day], [meal]: value.trim() };

    const daysValidation = validateDays(expanded);
    if (!daysValidation.ok) {
      return res.status(400).json({
        success: false,
        message: daysValidation.errors.days,
      });
    }

    const updatedPlan = {
      ...current,
      days: expanded,
      updatedAt: new Date().toISOString(),
    };

    mealPlans[index] = updatedPlan;
    await writeMealPlans(mealPlans);

    return res.status(200).json({
      success: true,
      message: 'Meal plan slot updated successfully',
      mealPlan: updatedPlan,
    });
  } catch (error) {
    console.error('Meal plan slot update error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the meal plan slot. Please try again.'
    });
  }
});

/**
 * @route  DELETE /api/mealplans/:id
 * @desc   Delete a meal plan.  The `userId` query (or body) param is required
 *         to prevent users from deleting other users' plans.
 * @param  {string} id     - The plan's ID.
 * @query  {string} userId - The requesting user's ID (used for ownership check).
 * @access Public (authentication recommended in future)
 *
 * @returns {200} `{ success, message }`
 * @returns {400} Missing `userId`.
 * @returns {403} Authenticated user does not own this plan.
 * @returns {404} Meal plan not found.
 * @returns {500} Unexpected server error.
 */
// Delete a meal plan by id (requires userId so users cannot delete others' plans)
app.delete('/api/mealplans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId ?? req.body?.userId;

    if (typeof userId !== 'string' || !userId.trim()) {
      return res.status(400).json({
        success: false,
        message: 'userId is required to delete a meal plan.',
      });
    }

    const mealPlans = await readMealPlans();
    const index = mealPlans.findIndex((plan) => String(plan.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Meal plan not found',
      });
    }

    const plan = mealPlans[index];
    if (String(plan.userId) !== String(userId.trim())) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own meal plan.',
      });
    }

    mealPlans.splice(index, 1);
    await writeMealPlans(mealPlans);

    return res.status(200).json({
      success: true,
      message: 'Meal plan deleted successfully',
    });
  } catch (error) {
    console.error('Meal plan delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the meal plan. Please try again.'
    });
  }
});
/**
 * @route  POST /api/recipes
 * @desc   Create a new recipe.
 * @body   RecipeFormData (see {@link validateRecipePayload} for accepted fields).
 * @access Public
 *
 * Validates and normalises the payload before persisting.
 *
 * @returns {201} `{ success, message, recipe }`
 * @returns {400} Validation failure (field-level `errors` included).
 * @returns {500} Unexpected server error.
 */
// Create recipe (validate + persist)
app.post('/api/recipes', async (req, res) => {
  try {
    const { ok, errors, normalized } = validateRecipePayload(req.body);

    if (!ok) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const recipes = await readRecipes();

    const newRecipe = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...normalized
    };

    recipes.push(newRecipe);
    await writeRecipes(recipes);

    return res.status(201).json({
      success: true,
      message: "Recipe created successfully",
      recipe: newRecipe,
    });
  } catch (error) {
    console.error('Recipe create error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while creating the recipe. Please try again.'
    });
  }
});

/**
 * @route  GET /api/recipes
 * @desc   List recipes with optional server-side filtering.
 * @query  {string}  [userId]       - Filter to only the requesting user's recipes.
 * @query  {number}  [maxPrepTime]  - Exclude recipes with prep time > this value.
 * @query  {number}  [maxCookTime]  - Exclude recipes with cook time > this value.
 * @query  {number}  [minServings]  - Exclude recipes with servings < this value.
 * @query  {number}  [maxServings]  - Exclude recipes with servings > this value.
 * @query  {string}  [search]       - Case-insensitive partial title search.
 * @query  {string}  [selectedTags] - Comma-separated dietary tags; all must match.
 * @query  {number}  [minCost]      - Minimum cost estimation.
 * @query  {number}  [maxCost]      - Maximum cost estimation.
 * @access Public
 *
 * @returns {200} `{ success, count, recipes }`
 * @returns {400} Invalid numeric filter parameter.
 * @returns {500} Unexpected server error.
 */
// Recipe filters: return all recipes, applying optional query filters
app.get('/api/recipes', async (req, res) => {
  try {
    const { userId, maxPrepTime, maxCookTime, minServings, maxServings, search, selectedTags, minCost, maxCost } = req.query;

    let recipes = await readRecipes();

    // Filter by userId if provided
    if (userId) {
      if (typeof userId !== 'string' || userId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId parameter'
        });
      }
      recipes = recipes.filter(r => String(r.userId) === String(userId));
    }
    
    // Filter by max prep time
    if (maxPrepTime) {
      const limit = Number(maxPrepTime);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxPrepTime must be a valid non-negative number'
        });
      }
      recipes = recipes.filter(r => {
        const v = Number(r.prepTime);
        return r.prepTime && Number.isFinite(v) && v <= limit;
      });
    }
    
    // Filter by max cook time
    if (maxCookTime) {
      const limit = Number(maxCookTime);
      if (!Number.isFinite(limit) || limit < 0) {
        return res.status(400).json({
          success: false,
          message: 'maxCookTime must be a valid non-negative number'
        });
      }
      recipes = recipes.filter(r => {
        const v = Number(r.cookTime);
        return r.cookTime && Number.isFinite(v) && v <= limit;
      });
    }
    
    // Filter by min servings
    if (minServings) {
      const limit = Number(minServings);
      if (!Number.isFinite(limit) || limit < 1) {
        return res.status(400).json({
          success: false,
          message: 'minServings must be a valid positive number'
        });
      }
      recipes = recipes.filter(r => {
        const v = Number(r.servings);
        return r.servings && Number.isFinite(v) && v >= limit;
      });
    }
    
    // Filter by max servings
    if (maxServings) {
      const limit = Number(maxServings);
      if (!Number.isFinite(limit) || limit < 1) {
        return res.status(400).json({
          success: false,
          message: 'maxServings must be a valid positive number'
        });
      }
      recipes = recipes.filter(r => {
        const v = Number(r.servings);
        return r.servings && Number.isFinite(v) && v <= limit;
      });
    }

    // Filter by search term - case-insensitive partial match against title
    if (search) {
      if (typeof search !== 'string' || search.trim().length === 0) {
        // treat empty search as no-op (do not error)
      } else {
        const q = String(search).trim().toLowerCase();
        recipes = recipes.filter(r => {
          const title = (r.title || r.name || '').toString().toLowerCase();
          return title.includes(q);
        });
      }
    }

    // Filter by dietary tags (all tags must be present)
    if (selectedTags) {
      const tagsArr = String(selectedTags).split(',').map(s => s.trim()).filter(Boolean);
      if (tagsArr.length > 0) {
        recipes = recipes.filter(r => {
          const rtags = Array.isArray(r.dietaryTags) ? r.dietaryTags.map(x => String(x)) : [];
          return tagsArr.every(t => rtags.includes(t));
        });
      }
    }

    // Filter by cost estimation range
    if (minCost) {
      const min = Number(minCost);
      if (!Number.isFinite(min) || min < 0) {
        return res.status(400).json({ success: false, message: 'minCost must be a valid non-negative number' });
      }
      recipes = recipes.filter(r => r.costEstimation !== undefined && !isNaN(Number(r.costEstimation)) && Number(r.costEstimation) >= min);
    }
    if (maxCost) {
      const max = Number(maxCost);
      if (!Number.isFinite(max) || max < 0) {
        return res.status(400).json({ success: false, message: 'maxCost must be a valid non-negative number' });
      }
      recipes = recipes.filter(r => r.costEstimation !== undefined && !isNaN(Number(r.costEstimation)) && Number(r.costEstimation) <= max);
    }

    return res.status(200).json({
      success: true,
      count: recipes.length,
      recipes
    });
  } catch (error) {
    console.error('Recipes fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching recipes. Please try again.'
    });
  }
});

/**
 * @route  GET /api/recipes/:id
 * @desc   Fetch a single recipe by its ID.
 * @param  {string} id - The recipe's ID.
 * @access Public
 *
 * @returns {200} `{ success, recipe }`
 * @returns {404} Recipe not found.
 * @returns {500} Unexpected server error.
 */
// Get one recipe by id
app.get('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const recipes = await readRecipes();
    const recipe = recipes.find(r => String(r.id) === String(id));

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    return res.status(200).json({
      success: true,
      recipe
    });
  } catch (error) {
    console.error('Recipe fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while fetching the recipe. Please try again.'
    });
  }
});

/**
 * @route  PUT /api/recipes/:id
 * @desc   Fully update an existing recipe.
 * @param  {string} id - The recipe's ID.
 * @body   RecipeFormData (see {@link validateRecipePayload}).
 * @access Public
 *
 * Preserves `id` and `createdAt` from the existing record.
 *
 * @returns {200} `{ success, message, recipe }`
 * @returns {400} Validation failure.
 * @returns {404} Recipe not found.
 * @returns {500} Unexpected server error.
 */
// Update a recipe by id
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { ok, errors, normalized } = validateRecipePayload(req.body);

    if (!ok) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    const recipes = await readRecipes();
    const index = recipes.findIndex(r => String(r.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    const updatedRecipe = {
      ...recipes[index],
      ...normalized,
      id: recipes[index].id,
      createdAt: recipes[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    recipes[index] = updatedRecipe;
    await writeRecipes(recipes);

    return res.status(200).json({
      success: true,
      message: 'Recipe updated successfully',
      recipe: updatedRecipe
    });
  } catch (error) {
    console.error('Recipe update error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the recipe. Please try again.'
    });
  }
});

/**
 * @route  DELETE /api/recipes/:id
 * @desc   Delete a recipe owned by the authenticated user.
 * @param  {string} id - The recipe's ID.
 * @access Protected (requires Bearer JWT via {@link authenticateToken})
 *
 * The JWT's `userId` is compared against the recipe's `userId` field to
 * prevent users from deleting other users' recipes.
 *
 * @returns {200} `{ success, message }`
 * @returns {401} No or invalid JWT.
 * @returns {403} Authenticated user does not own this recipe.
 * @returns {404} Recipe not found.
 * @returns {500} Unexpected server error.
 */
// Delete a recipe by id
app.delete('/api/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const recipes = await readRecipes();
    const index = recipes.findIndex(r => String(r.id) === String(id));

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    // Authorization: Check if user owns the recipe
    const recipe = recipes[index];
    if (recipe.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own recipes'
      });
    }

    recipes.splice(index, 1);
    await writeRecipes(recipes);

    return res.status(200).json({
      success: true,
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    console.error('Recipe delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while deleting the recipe. Please try again.'
    });
  }
});


/**
 * Global Express error handler.
 *
 * Catches any unhandled errors thrown inside route handlers and returns a
 * generic 500 response so the client never receives an unformatted stack trace.
 *
 * @param {Error}  err  - The error object thrown.
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next - Required by Express signature but unused.
 */
// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again.'
  });
});

export default app;

if (process.env.NODE_ENV === 'test') {
  initializeDataFile().catch((error) => {
    console.error('Failed to initialize data file for tests:', error);
    process.exit(1);
  });
} else {
  initializeDataFile().then(() => {
      app.listen(PORT, () => {
        console.log(`MealMajor backend running on http://localhost:${PORT}`);
        console.log(`User data stored in: ${USERS_FILE}`);
      });
    })
    .catch(error => {
      console.error('Failed to initialize server:', error);
      process.exit(1);
    });
}
