import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { jest } from "@jest/globals";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEMINI_SUGGESTIONS_FILE = path.join(__dirname, "..", "..", "..", "data", "gemini_suggestions.json");

// Mock the generateMealSuggestion function before importing the app
const mockSuggestion = {
  starter: {
    name: "Bruschetta",
    description: "Classic Italian starter",
    servings: 4,
    prepTime: 10,
    cookTime: 5,
    ingredients: [{ name: "Tomatoes", amount: "4", unit: "pcs" }],
    instructions: [{ step: "Dice tomatoes and place on bread" }],
  },
  mainCourse: {
    name: "Pasta Primavera",
    description: "Fresh vegetable pasta",
    servings: 4,
    prepTime: 15,
    cookTime: 20,
    ingredients: [{ name: "Pasta", amount: "500", unit: "g" }],
    instructions: [{ step: "Cook pasta and toss with vegetables" }],
  },
  dessert: {
    name: "Tiramisu",
    description: "Italian coffee dessert",
    servings: 6,
    prepTime: 30,
    cookTime: 0,
    ingredients: [{ name: "Mascarpone", amount: "500", unit: "g" }],
    instructions: [{ step: "Layer coffee-soaked ladyfingers with mascarpone" }],
  },
};

jest.unstable_mockModule("../../../src/gemini.js", () => ({
  generateMealSuggestion: jest.fn().mockResolvedValue(mockSuggestion),
  searchCourseImage: jest.fn().mockResolvedValue({ imageUrl: "https://example.com/image.jpg" }),
}));

const { default: app, initializeDataFile } = await import("../../../src/server.js");

beforeAll(async () => {
  await initializeDataFile();
  // Ensure gemini suggestions file exists
  await fs.mkdir(path.join(__dirname, "..", "..", "..", "data"), { recursive: true });
  try {
    await fs.access(GEMINI_SUGGESTIONS_FILE);
  } catch {
    await fs.writeFile(GEMINI_SUGGESTIONS_FILE, JSON.stringify([], null, 2));
  }
});

describe("US 20 - AI-Powered Meal Suggestion (Gemini)", () => {

  // UT-20.01 — Successful 3-course meal suggestion generation
  test("POST /api/gemini/meal-suggestion returns a 3-course meal with valid input", async () => {
    const res = await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({ cuisine: "Italian" });

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.suggestion).toBeDefined();
    expect(res.body?.suggestion?.starter).toBeDefined();
    expect(res.body?.suggestion?.mainCourse).toBeDefined();
    expect(res.body?.suggestion?.dessert).toBeDefined();

    // Verify starter has required fields
    const starter = res.body.suggestion.starter;
    expect(starter.name).toBeTruthy();
    expect(starter.ingredients).toBeDefined();
    expect(starter.instructions).toBeDefined();
  });

  // UT-20.02 — Missing cuisine returns 400
  test("POST /api/gemini/meal-suggestion without cuisine returns 400", async () => {
    const res = await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
    expect(res.body?.message).toMatch(/cuisine/i);
  });

  // UT-20.03 — Suggestion is stored with context
  test("Meal suggestion is persisted in the data file with context", async () => {
    // Clear suggestions file
    await fs.writeFile(GEMINI_SUGGESTIONS_FILE, JSON.stringify([], null, 2));

    const res = await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({ cuisine: "Thai", dietPreference: "vegan", allergies: ["peanuts"] });

    expect(res.statusCode).toBe(200);
    expect(res.body?.context).toBeDefined();
    expect(res.body?.context?.cuisine).toBe("Thai");
    expect(res.body?.context?.dietPreference).toBe("vegan");

    // Verify persisted
    const data = await fs.readFile(GEMINI_SUGGESTIONS_FILE, "utf8");
    const records = JSON.parse(data);
    expect(records.length).toBeGreaterThanOrEqual(1);

    const stored = records.find((r) => r.cuisine === "Thai");
    expect(stored).toBeDefined();
    expect(stored.allergies).toEqual(["peanuts"]);
    expect(stored.suggestion).toBeDefined();
  });

  // UT-20.04 — Suggestion with userId uses stored user diet preferences
  test("Suggestion with userId falls back to user's stored preferences", async () => {
    // Create a user with diet preferences
    const unique = Date.now();
    const email = `gemini.${unique}@example.com`;

    const regRes = await request(app).post("/api/register").send({
      firstName: "Gemini",
      lastName: "Tester",
      email,
      password: "StrongPass!234",
    });
    expect(regRes.statusCode).toBe(201);
    const userId = regRes.body?.user?.id;

    // Set diet preferences
    await request(app)
      .patch(`/api/profile/${userId}`)
      .send({ dietPreference: "vegetarian", allergies: ["shellfish"] });

    // Generate suggestion with userId (no explicit diet preference)
    const res = await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({ userId, cuisine: "Japanese" });

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.context?.userId).toBe(userId);
  });

  // UT-20.05 — Fetch stored suggestions filtered by userId
  test("GET /api/gemini/meal-suggestions returns stored records filtered by userId", async () => {
    const unique = Date.now();
    const email = `fetch.sugg.${unique}@example.com`;

    const regRes = await request(app).post("/api/register").send({
      firstName: "Fetch",
      lastName: "Sugg",
      email,
      password: "StrongPass!234",
    });
    const userId = regRes.body?.user?.id;

    // Generate a suggestion for this user
    await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({ userId, cuisine: "Mexican" });

    // Fetch suggestions for this user
    const res = await request(app)
      .get("/api/gemini/meal-suggestions")
      .query({ userId });

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.records?.length).toBeGreaterThanOrEqual(1);
    expect(res.body?.records?.every((r) => r.userId === userId)).toBe(true);
  });

  // UT-20.06 — Invalid allergies type returns 400
  test("POST /api/gemini/meal-suggestion with non-array allergies returns 400", async () => {
    const res = await request(app)
      .post("/api/gemini/meal-suggestion")
      .send({ cuisine: "French", allergies: "not-an-array" });

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
  });
});
