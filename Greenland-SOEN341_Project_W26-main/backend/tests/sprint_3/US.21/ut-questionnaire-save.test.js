import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import app, { initializeDataFile } from "../../../src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECIPES_FILE = path.join(__dirname, "..", "..", "..", "data", "recipes.json");

describe("US 21 - Meal Generation Questionnaire & Save to Recipes", () => {
  let userId;

  beforeAll(async () => {
    await initializeDataFile();
    // Ensure recipes file exists
    await fs.mkdir(path.join(__dirname, "..", "..", "..", "data"), { recursive: true });
    try {
      await fs.access(RECIPES_FILE);
    } catch {
      await fs.writeFile(RECIPES_FILE, JSON.stringify([], null, 2));
    }
  });

  beforeEach(async () => {
    // Register a user to save recipes under
    const unique = Date.now();
    const email = `questionnaire.${unique}@example.com`;
    const password = "StrongPass!234";

    const regRes = await request(app).post("/api/register").send({
      firstName: "Quiz",
      lastName: "User",
      email,
      password,
    });
    expect(regRes.statusCode).toBe(201);
    userId = regRes.body?.user?.id;
  });

  // UT-21.01 — Save a generated course as a recipe
  test("User can save a generated meal course as a recipe via POST /api/recipes", async () => {
    // Simulate saving a generated course (like DietAndMeals "Save to Recipes" button does)
    const courseData = {
      userId,
      title: "Bruschetta",
      description: "Classic Italian starter from AI suggestion",
      ingredients: [
        { name: "Tomatoes", amount: "4", unit: "pcs" },
        { name: "Basil", amount: "10", unit: "leaves" },
      ],
      instructions: [
        { step: "Dice tomatoes" },
        { step: "Place on toasted bread with basil" },
      ],
      prepTime: 10,
      cookTime: 5,
      servings: 4,
    };

    const res = await request(app).post("/api/recipes").send(courseData);

    expect(res.statusCode).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.recipe).toBeDefined();
    expect(res.body?.recipe?.title).toBe("Bruschetta");
    expect(res.body?.recipe?.userId).toBe(userId);
    expect(res.body?.recipe?.id).toBeTruthy();

    // Verify persisted
    const data = await fs.readFile(RECIPES_FILE, "utf8");
    const recipes = JSON.parse(data);
    const saved = recipes.find((r) => r.id === res.body.recipe.id);
    expect(saved).toBeDefined();
    expect(saved.title).toBe("Bruschetta");
  });

  // UT-21.02 — Saved recipe appears in user's recipe list
  test("Saved recipe from questionnaire appears in GET /api/recipes for that user", async () => {
    const courseData = {
      userId,
      title: "Pasta Primavera",
      description: "Fresh vegetable pasta from AI generation",
      ingredients: [{ name: "Pasta", amount: "500", unit: "g" }],
      instructions: [{ step: "Cook pasta and toss with vegetables" }],
      prepTime: 15,
      cookTime: 20,
      servings: 4,
    };

    const createRes = await request(app).post("/api/recipes").send(courseData);
    expect(createRes.statusCode).toBe(201);

    // Fetch recipes for this user
    const fetchRes = await request(app)
      .get("/api/recipes")
      .query({ userId });

    expect(fetchRes.statusCode).toBe(200);
    expect(fetchRes.body?.success).toBe(true);
    expect(fetchRes.body?.recipes?.length).toBeGreaterThanOrEqual(1);

    const found = fetchRes.body.recipes.find(
      (r) => r.title === "Pasta Primavera"
    );
    expect(found).toBeDefined();
    expect(found.userId).toBe(userId);
  });

  // UT-21.03 — User profile diet preferences are available for questionnaire
  test("User diet preferences can be set and read for questionnaire pre-fill", async () => {
    // Set diet preferences
    const patchRes = await request(app)
      .patch(`/api/profile/${userId}`)
      .send({ dietPreference: "vegan", allergies: ["dairy", "eggs"] });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.user?.dietPreference).toBe("vegan");
    expect(patchRes.body?.user?.allergies).toEqual(["dairy", "eggs"]);

    // Read profile to confirm questionnaire can pre-fill
    const profileRes = await request(app).get(`/api/profile/${userId}`);
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body?.user?.dietPreference).toBe("vegan");
    expect(profileRes.body?.user?.allergies).toEqual(["dairy", "eggs"]);
  });

  // UT-21.04 — Saving a recipe without required fields fails validation
  test("Saving a generated course without title fails validation", async () => {
    const res = await request(app).post("/api/recipes").send({
      userId,
      title: "",
      ingredients: [{ name: "Tomato", amount: "1", unit: "pcs" }],
      instructions: [{ step: "Do something" }],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.errors?.title).toBeDefined();
  });

  // UT-21.05 — Saving a recipe without ingredients fails validation
  test("Saving a generated course without ingredients fails validation", async () => {
    const res = await request(app).post("/api/recipes").send({
      userId,
      title: "Test Recipe",
      ingredients: [],
      instructions: [{ step: "Do something" }],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.errors?.ingredients).toBeDefined();
  });

  // UT-21.06 — Saving a recipe without instructions fails validation
  test("Saving a generated course without instructions fails validation", async () => {
    const res = await request(app).post("/api/recipes").send({
      userId,
      title: "Test Recipe",
      ingredients: [{ name: "Something", amount: "1", unit: "g" }],
      instructions: [],
    });

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.errors?.instructions).toBeDefined();
  });
});
