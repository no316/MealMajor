import request from "supertest";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECIPES_FILE = path.join(__dirname, "..", "..", "..", "data", "recipes.json");
const USERS_FILE = path.join(__dirname, "..", "..", "..", "data", "users.json");

beforeAll(async () => {
  await initializeDataFile();
  await initializeMealPlansFile();
});

describe("Recipe Management - Create, Read, Update, Delete, Search, Filter (Sprint 2)", () => {
  let userId1;
  let userId2;
  let userToken1;
  let userToken2;
  let recipeId1;

  beforeEach(async () => {
    const users = [
      {
        id: "user-recipe-test-1",
        firstName: "Chef",
        lastName: "One",
        email: "chef1@test.com",
        password: "password123",
        registeredAt: new Date().toISOString(),
      },
      {
        id: "user-recipe-test-2",
        firstName: "Chef",
        lastName: "Two",
        email: "chef2@test.com",
        password: "password456",
        registeredAt: new Date().toISOString(),
      },
    ];
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    userId1 = users[0].id;
    userId2 = users[1].id;

    const login1 = await request(app)
      .post("/api/login")
      .send({ email: "chef1@test.com", password: "password123" });
    userToken1 = login1.body.token;

    const login2 = await request(app)
      .post("/api/login")
      .send({ email: "chef2@test.com", password: "password456" });
    userToken2 = login2.body.token;

    const recipes = [
      {
        id: "recipe-1",
        userId: userId1,
        title: "Pasta Carbonara",
        description: "Classic Italian pasta with eggs and cheese",
        ingredients: [
          { id: 1, name: "Pasta", amount: "400", unit: "g" },
          { id: 2, name: "Eggs", amount: "4", unit: "" },
        ],
        instructions: [
          { id: 1, step: "Boil pasta" },
          { id: 2, step: "Mix eggs and cheese" },
        ],
        prepTime: 10,
        cookTime: 20,
        servings: 4,
        dietaryTags: ["vegetarian", "italian"],
        costEstimation: 8,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "recipe-2",
        userId: userId1,
        title: "Grilled Chicken Salad",
        description: "Healthy grilled chicken with fresh vegetables",
        ingredients: [
          { id: 1, name: "Chicken Breast", amount: "300", unit: "g" },
          { id: 2, name: "Lettuce", amount: "200", unit: "g" },
        ],
        instructions: [
          { id: 1, step: "Grill chicken" },
          { id: 2, step: "Chop vegetables" },
        ],
        prepTime: 15,
        cookTime: 15,
        servings: 2,
        dietaryTags: ["healthy", "lowcarb"],
        costEstimation: 10,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "recipe-3",
        userId: userId2,
        title: "Vegetable Stir Fry",
        description: "Quick and colorful vegetable stir fry",
        ingredients: [
          { id: 1, name: "Broccoli", amount: "200", unit: "g" },
          { id: 2, name: "Soy Sauce", amount: "50", unit: "ml" },
        ],
        instructions: [
          { id: 1, step: "Heat wok" },
          { id: 2, step: "Add vegetables" },
        ],
        prepTime: 10,
        cookTime: 10,
        servings: 3,
        dietaryTags: ["vegan", "quick"],
        costEstimation: 6,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
    recipeId1 = recipes[0].id;
  });

  afterEach(async () => {
    try {
      await fs.writeFile(RECIPES_FILE, JSON.stringify([], null, 2));
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Create Recipe Tests", () => {
    test("Create recipe with valid data", async () => {
      const newRecipe = {
        userId: userId1,
        title: "New Recipe",
        description: "A new test recipe",
        ingredients: [{ id: 1, name: "Ingredient 1", amount: "100", unit: "g" }],
        instructions: [{ id: 1, step: "Do something" }],
        prepTime: 5,
        cookTime: 10,
        servings: 2,
      };

      const res = await request(app)
        .post("/api/recipes")
        .send(newRecipe);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.recipe).toBeDefined();
      expect(res.body.recipe.title).toBe("New Recipe");
    });

    test("Create recipe fails with missing userId", async () => {
      const invalidRecipe = {
        title: "No User Recipe",
        ingredients: [{ name: "Ingredient" }],
        instructions: [{ step: "Step" }],
      };

      const res = await request(app)
        .post("/api/recipes")
        .send(invalidRecipe);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("Create recipe fails with missing title", async () => {
      const invalidRecipe = {
        userId: userId1,
        ingredients: [{ name: "Ingredient" }],
        instructions: [{ step: "Step" }],
      };

      const res = await request(app)
        .post("/api/recipes")
        .send(invalidRecipe);

      expect(res.statusCode).toBe(400);
    });

    test("Create recipe fails with empty ingredients", async () => {
      const invalidRecipe = {
        userId: userId1,
        title: "No Ingredients",
        ingredients: [],
        instructions: [{ step: "Step" }],
      };

      const res = await request(app)
        .post("/api/recipes")
        .send(invalidRecipe);

      expect(res.statusCode).toBe(400);
    });
  });

  describe("Read Recipe Tests", () => {
    test("Get all recipes", async () => {
      const res = await request(app).get("/api/recipes");

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.recipes)).toBe(true);
      expect(res.body.count).toBe(3);
    });

    test("Get recipe by id", async () => {
      const res = await request(app).get(`/api/recipes/${recipeId1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recipe.id).toBe(recipeId1);
      expect(res.body.recipe.title).toBe("Pasta Carbonara");
    });

    test("Get non-existent recipe returns 404", async () => {
      const res = await request(app).get("/api/recipes/non-existent-id");

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Update Recipe Tests", () => {
    test("Update recipe with valid data", async () => {
      const updateData = {
        userId: userId1,
        title: "Updated Carbonara",
        description: "Updated description",
        ingredients: [
          { id: 1, name: "Pasta", amount: "500", unit: "g" },
          { id: 2, name: "Eggs", amount: "5", unit: "" },
        ],
        instructions: [
          { id: 1, step: "Updated step 1" },
          { id: 2, step: "Updated step 2" },
        ],
        prepTime: 15,
        cookTime: 25,
        servings: 5,
      };

      const res = await request(app)
        .put(`/api/recipes/${recipeId1}`)
        .send(updateData);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recipe.title).toBe("Updated Carbonara");
    });

    test("Update non-existent recipe returns 404", async () => {
      const updateData = {
        userId: userId1,
        title: "Test",
        ingredients: [{ name: "Ingredient" }],
        instructions: [{ step: "Step" }],
      };

      const res = await request(app)
        .put("/api/recipes/non-existent")
        .send(updateData);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Delete Recipe Tests", () => {
    test("Delete recipe with valid token", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipeId1}`)
        .set("Authorization", `Bearer ${userToken1}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("Delete recipe without token returns 401", async () => {
      const res = await request(app).delete(`/api/recipes/${recipeId1}`);

      expect(res.statusCode).toBe(401);
    });

    test("User cannot delete another user's recipe", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipeId1}`)
        .set("Authorization", `Bearer ${userToken2}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Search Recipe Tests", () => {
    test("Search recipes by title", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ search: "Pasta" });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.recipes[0].title).toBe("Pasta Carbonara");
    });

    test("Search is case-insensitive", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ search: "pasta" });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
    });

    test("Search with no matches returns empty", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ search: "NonExistent" });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe("Filter Recipe Tests", () => {
    test("Filter recipes by userId", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ userId: userId1 });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test("Filter recipes by maxPrepTime", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ maxPrepTime: 10 });

      expect(res.statusCode).toBe(200);
      expect(res.body.recipes.every(r => Number(r.prepTime) <= 10)).toBe(true);
    });

    test("Filter recipes by maxCookTime", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ maxCookTime: 15 });

      expect(res.statusCode).toBe(200);
      expect(res.body.recipes.every(r => Number(r.cookTime) <= 15)).toBe(true);
    });

    test("Filter recipes by minServings", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ minServings: 3 });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(2);
    });

    test("Filter recipes by dietary tags", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ selectedTags: "vegetarian,italian" });

      expect(res.statusCode).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.recipes[0].title).toBe("Pasta Carbonara");
    });

    test("Filter recipes by minCost", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ minCost: 8 });

      expect(res.statusCode).toBe(200);
      expect(res.body.recipes.every(r => Number(r.costEstimation) >= 8)).toBe(true);
    });

    test("Combine multiple filters", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ userId: userId1, maxPrepTime: 15, minServings: 2 });

      expect(res.statusCode).toBe(200);
      expect(res.body.recipes.every(r => 
        r.userId === userId1 && 
        Number(r.prepTime) <= 15 && 
        Number(r.servings) >= 2
      )).toBe(true);
    });
  });
});

