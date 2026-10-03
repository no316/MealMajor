import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEALPLANS_FILE = path.join(__dirname, "..", "..", "..", "data", "mealplans.json");

describe("US 18 - Edit or Remove Meals from the Planner", () => {
  let userId, planId;

  beforeAll(async () => {
    await initializeDataFile();
    await initializeMealPlansFile();
  });

  beforeEach(async () => {
    // Register and log in a fresh user for each test
    const unique = Date.now();
    const email = `edit.meal.${unique}@example.com`;
    const password = "StrongPass!234";

    const registerRes = await request(app).post("/api/register").send({
      firstName: "Edit",
      lastName: "Tester",
      email,
      password,
    });
    expect(registerRes.statusCode).toBe(201);
    userId = registerRes.body?.user?.id;

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);

    // Create a meal plan with some initial assignments
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;
    const createRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: { breakfast: "Oatmeal", lunch: "Salad", dinner: "Pasta", snack: "" },
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

  // UT-18.01 — Edit a meal slot in an existing plan
  test("User can edit a meal slot to change the assigned recipe", async () => {
    // Step 1: Update monday lunch from "Salad" to "Soup"
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "monday", meal: "lunch", value: "Soup" });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.success).toBe(true);
    expect(patchRes.body?.mealPlan?.days?.monday?.lunch).toBe("Soup");

    // Step 2: Verify the change persisted in the data file
    const data = await fs.readFile(MEALPLANS_FILE, "utf8");
    const plans = JSON.parse(data);
    const plan = plans.find((p) => p.id === planId);
    expect(plan).toBeDefined();
    expect(plan.days.monday.lunch).toBe("Soup");

    // Step 3: Verify other slots remain unchanged
    expect(plan.days.monday.breakfast).toBe("Oatmeal");
    expect(plan.days.monday.dinner).toBe("Pasta");
  });

  // UT-18.02 — Remove a meal from a slot by clearing it
  test("User can remove a meal from a slot by setting it to empty string", async () => {
    // Step 1: Clear monday dinner slot
    const patchRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "monday", meal: "dinner", value: "" });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body?.success).toBe(true);
    expect(patchRes.body?.mealPlan?.days?.monday?.dinner).toBe("");

    // Step 2: Verify persisted
    const data = await fs.readFile(MEALPLANS_FILE, "utf8");
    const plans = JSON.parse(data);
    const plan = plans.find((p) => p.id === planId);
    expect(plan.days.monday.dinner).toBe("");

    // Step 3: Other slots unaffected
    expect(plan.days.monday.breakfast).toBe("Oatmeal");
    expect(plan.days.monday.lunch).toBe("Salad");
  });

  // UT-18.03 — Delete an entire meal plan
  test("User can delete their own meal plan", async () => {
    // Step 1: Delete the meal plan
    const deleteRes = await request(app)
      .delete(`/api/mealplans/${planId}`)
      .query({ userId });

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body?.success).toBe(true);
    expect(deleteRes.body?.message).toContain("deleted");

    // Step 2: Verify plan no longer exists in data
    const data = await fs.readFile(MEALPLANS_FILE, "utf8");
    const plans = JSON.parse(data);
    const plan = plans.find((p) => p.id === planId);
    expect(plan).toBeUndefined();
  });

  // UT-18.04 — Cannot delete another user's meal plan
  test("User cannot delete a meal plan owned by another user", async () => {
    const deleteRes = await request(app)
      .delete(`/api/mealplans/${planId}`)
      .query({ userId: "some-other-user-id" });

    expect(deleteRes.statusCode).toBe(403);
    expect(deleteRes.body?.success).toBe(false);
  });

  // UT-18.05 — Editing a non-existent meal plan returns 404
  test("Editing a slot on a non-existent meal plan returns 404", async () => {
    const patchRes = await request(app)
      .patch("/api/mealplans/nonexistent-id/slot")
      .send({ day: "monday", meal: "lunch", value: "Soup" });

    expect(patchRes.statusCode).toBe(404);
    expect(patchRes.body?.success).toBe(false);
  });

  // UT-18.06 — Invalid day or meal slot returns 400
  test("Invalid day or meal slot returns 400", async () => {
    const badDayRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "funday", meal: "lunch", value: "Soup" });

    expect(badDayRes.statusCode).toBe(400);
    expect(badDayRes.body?.success).toBe(false);

    const badMealRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: "monday", meal: "brunch", value: "Soup" });

    expect(badMealRes.statusCode).toBe(400);
    expect(badMealRes.body?.success).toBe(false);
  });
});
