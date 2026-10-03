import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEALPLANS_FILE = path.join(__dirname, "..", "..", "..", "data", "mealplans.json");

describe("US 19 - Prevent Duplicates for the Same Week", () => {
  let userId, planId;

  beforeAll(async () => {
    await initializeDataFile();
    await initializeMealPlansFile();
  });

  beforeEach(async () => {
    const unique = Date.now();
    const email = `dup.check.${unique}@example.com`;
    const password = "StrongPass!234";

    const registerRes = await request(app).post("/api/register").send({
      firstName: "Dup",
      lastName: "Checker",
      email,
      password,
    });
    expect(registerRes.statusCode).toBe(201);
    userId = registerRes.body?.user?.id;

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);

    // Create a meal plan with a recipe already assigned
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;
    const createRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: { breakfast: "recipe-1", lunch: "", dinner: "", snack: "" },
        tuesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        wednesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        thursday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        friday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        saturday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        sunday: { breakfast: "", lunch: "", dinner: "", snack: "" },
      },
    });
    expect(createRes.statusCode).toBe(201);
    planId = createRes.body?.mealPlan?.id;
    expect(planId).toBeTruthy();
  });

  // UT-19.01 — Duplicate recipe assignment in same week is rejected
  test("Assigning a recipe that already exists in the same week is rejected", async () => {
    // "recipe-1" is already assigned to monday breakfast
    // Try to assign it to tuesday lunch — should be rejected
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "tuesday", meal: "lunch", value: "recipe-1" });

    expect(patchRes.statusCode).toBe(400);
    expect(patchRes.body?.success).toBe(false);
    expect(patchRes.body?.message).toMatch(/already assigned/i);
  });

  // UT-19.02 — Unique recipe assignment in different slot succeeds
  test("Assigning a different recipe to a different slot succeeds", async () => {
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "tuesday", meal: "lunch", value: "recipe-2" });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.success).toBe(true);
    expect(patchRes.body?.mealPlan?.days?.tuesday?.lunch).toBe("recipe-2");
  });

  // UT-19.03 — Clearing a slot (empty string) is always allowed
  test("Clearing a slot by setting value to empty string always succeeds", async () => {
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "monday", meal: "breakfast", value: "" });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.success).toBe(true);
    expect(patchRes.body?.mealPlan?.days?.monday?.breakfast).toBe("");
  });

  // UT-19.04 — Re-assigning same recipe to its current slot succeeds (editing in place)
  test("Re-assigning same recipe to its own slot succeeds (not a duplicate)", async () => {
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "monday", meal: "breakfast", value: "recipe-1" });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.success).toBe(true);
    expect(patchRes.body?.mealPlan?.days?.monday?.breakfast).toBe("recipe-1");
  });

  // UT-19.05 — One meal plan per user per week enforced on creation
  test("Creating a second meal plan for same user and week is rejected", async () => {
    // The plan already exists from beforeEach
    const data = await fs.readFile(MEALPLANS_FILE, "utf8");
    const plans = JSON.parse(data);
    const existingPlan = plans.find((p) => p.id === planId);
    const weekId = existingPlan.weekId;

    const duplicateRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        tuesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        wednesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        thursday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        friday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        saturday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        sunday: { breakfast: "", lunch: "", dinner: "", snack: "" },
      },
    });

    expect(duplicateRes.statusCode).toBe(409);
    expect(duplicateRes.body?.success).toBe(false);
    expect(duplicateRes.body?.message).toMatch(/already exists/i);
  });

  // UT-19.06 — Days validation rejects invalid day keys
  test("Days with invalid day keys are rejected on creation", async () => {
    const unique = Date.now() + 999;
    const createRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId: `2026-W${String((unique % 40) + 10).padStart(2, "0")}`,
      days: {
        invalidday: { breakfast: "something", lunch: "", dinner: "", snack: "" },
      },
    });

    expect(createRes.statusCode).toBe(400);
    expect(createRes.body?.success).toBe(false);
  });
});
