import request from "supertest";
import { jest } from "@jest/globals";
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

describe("AT - Delete Recipe (Task.10.02)", () => {
  let user1Token;
  let user2Token;
  let user1Id;
  let user2Id;
  let recipe1Id;
  let recipe2Id;

  beforeEach(async () => {
    // Set up test users
    const users = [
      {
        id: "test-user-1",
        firstName: "John",
        lastName: "Doe",
        email: "john@test.com",
        password: "password123",
        registeredAt: new Date().toISOString(),
      },
      {
        id: "test-user-2",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@test.com",
        password: "password456",
        registeredAt: new Date().toISOString(),
      },
    ];
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    user1Id = users[0].id;
    user2Id = users[1].id;

    // Login to get tokens
    const res1 = await request(app)
      .post("/api/login")
      .send({ email: "john@test.com", password: "password123" });
    user1Token = res1.body.token;

    const res2 = await request(app)
      .post("/api/login")
      .send({ email: "jane@test.com", password: "password456" });
    user2Token = res2.body.token;

    // Set up test recipes
    const recipes = [
      {
        id: "test-recipe-1",
        userId: user1Id,
        title: "User 1's Recipe",
        description: "A recipe owned by user 1",
        ingredients: [{ id: 1, name: "Ingredient 1", amount: "100", unit: "g" }],
        instructions: [{ id: 1, step: "Step 1" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "test-recipe-2",
        userId: user2Id,
        title: "User 2's Recipe",
        description: "A recipe owned by user 2",
        ingredients: [{ id: 1, name: "Ingredient 2", amount: "200", unit: "g" }],
        instructions: [{ id: 1, step: "Step 1" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));
    recipe1Id = recipes[0].id;
    recipe2Id = recipes[1].id;
  });

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.writeFile(RECIPES_FILE, JSON.stringify([], null, 2));
      await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Authentication Tests", () => {
    test("DELETE without token returns 401", async () => {
      const res = await request(app).delete(`/api/recipes/${recipe1Id}`);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access token required");
    });

    test("DELETE with invalid token returns 401", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", "Bearer invalid-token-here");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Invalid token");
    });

    test("DELETE with malformed authorization header returns 401", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", "InvalidFormat");

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Authorization Tests", () => {
    test("User can delete their own recipe successfully", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Recipe deleted successfully");
    });

    test("User cannot delete another user's recipe", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe2Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("You can only delete your own recipes");
    });

    test("Attempting to delete own recipe with another user's token fails", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user2Token}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Recipe Existence Tests", () => {
    test("DELETE non-existent recipe returns 404", async () => {
      const res = await request(app)
        .delete("/api/recipes/non-existent-id")
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Recipe not found");
    });
  });

  describe("Success Scenario Tests", () => {
    test("Recipe is actually removed from recipes.json", async () => {
      // Delete the recipe
      await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      // Verify it's removed from file
      const data = await fs.readFile(RECIPES_FILE, "utf8");
      const recipes = JSON.parse(data);

      const deletedRecipe = recipes.find(r => r.id === recipe1Id);
      expect(deletedRecipe).toBeUndefined();
      expect(recipes.length).toBe(1); // Only recipe2 should remain
    });

    test("Subsequent GET for deleted recipe returns 404", async () => {
      // Delete the recipe
      await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      // Try to GET the deleted recipe
      const res = await request(app).get(`/api/recipes/${recipe1Id}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("Deleting recipe does not affect other recipes", async () => {
      // Delete user1's recipe
      await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      // Verify user2's recipe still exists
      const res = await request(app).get(`/api/recipes/${recipe2Id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recipe.id).toBe(recipe2Id);
    });

    test("User can delete multiple recipes they own", async () => {
      // Create another recipe for user1
      const recipes = JSON.parse(await fs.readFile(RECIPES_FILE, "utf8"));
      const recipe3 = {
        id: "test-recipe-3",
        userId: user1Id,
        title: "User 1's Second Recipe",
        description: "Another recipe",
        ingredients: [{ id: 1, name: "Ingredient", amount: "50", unit: "g" }],
        instructions: [{ id: 1, step: "Step" }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      recipes.push(recipe3);
      await fs.writeFile(RECIPES_FILE, JSON.stringify(recipes, null, 2));

      // Delete first recipe
      const res1 = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);
      expect(res1.statusCode).toBe(200);

      // Delete second recipe
      const res2 = await request(app)
        .delete(`/api/recipes/${recipe3.id}`)
        .set("Authorization", `Bearer ${user1Token}`);
      expect(res2.statusCode).toBe(200);

      // Verify both deleted
      const updatedRecipes = JSON.parse(await fs.readFile(RECIPES_FILE, "utf8"));
      expect(updatedRecipes.length).toBe(1);
      expect(updatedRecipes[0].id).toBe(recipe2Id);
    });
  });

  describe("Error Handling Tests", () => {
    test("Server handles corrupted recipes file gracefully", async () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});

      // Corrupt the recipes file
      await fs.writeFile(RECIPES_FILE, "{ invalid json");

      const res = await request(app)
        .delete(`/api/recipes/${recipe1Id}`)
        .set("Authorization", `Bearer ${user1Token}`);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);

      spy.mockRestore();

      // Restore valid file for cleanup
      await fs.writeFile(RECIPES_FILE, JSON.stringify([], null, 2));
    });
  });
});
