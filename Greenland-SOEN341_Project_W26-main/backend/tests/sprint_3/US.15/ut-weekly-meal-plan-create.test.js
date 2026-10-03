import request from "supertest";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEALPLANS_FILE = path.join(__dirname, "..", "..", "..", "data", "mealplans.json");

describe("US 15 - Create a Weekly Meal Plan", () => {
  beforeAll(async () => {
    // Ensure required JSON stores exist before acceptance flow runs.
    await initializeDataFile();
    await initializeMealPlansFile();
  });

  // UT - 15.01 — US.15 Authenticate user create and save meal plans for given week (#158): 
  test("Logged-in user creates a weekly meal plan for a week with no existing plan", async () => {
    const unique = Date.now();
    const email = `weekly.plan.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;

    // Step 1: user is registered and authenticated (logged in).
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Weekly",
      lastName: "Planner",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body?.success).toBe(true);

    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    expect(loginRes.body?.token).toBeTruthy();
    expect(loginRes.body?.user?.id).toBe(userId);

    // Step 2: chosen week has no existing plan yet.
    const initialPlannerViewRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(initialPlannerViewRes.statusCode).toBe(200);
    expect(initialPlannerViewRes.body?.success).toBe(true);
    expect(initialPlannerViewRes.body?.count).toBe(0);
    expect(initialPlannerViewRes.body?.mealPlans).toEqual([]);

    // Step 3a: create request is accepted in the backend.
    const createRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      },
    });

    expect(createRes.statusCode).toBe(201);
    expect(createRes.body?.success).toBe(true);
    expect(createRes.body?.mealPlan).toBeDefined();
    expect(createRes.body?.mealPlan?.userId).toBe(userId);
    expect(createRes.body?.mealPlan?.weekId).toBe(weekId);

    // Step 3b: verify that a meal plan exists for that user and week identifier in the backend.
    const mealPlansData = await fs.readFile(MEALPLANS_FILE, "utf8");
    const mealPlans = JSON.parse(mealPlansData);
    const persistedPlan = mealPlans.find(
      (plan) => plan.userId === userId && plan.weekId === weekId
    );

    expect(persistedPlan).toBeDefined();

    // Step 3c: verify user can see the newly created plan for that week.
    const plannerViewAfterCreateRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerViewAfterCreateRes.statusCode).toBe(200);
    expect(plannerViewAfterCreateRes.body?.success).toBe(true);
    expect(plannerViewAfterCreateRes.body?.count).toBe(1);
    expect(Array.isArray(plannerViewAfterCreateRes.body?.mealPlans)).toBe(true);
    expect(plannerViewAfterCreateRes.body?.mealPlans[0]?.userId).toBe(userId);
    expect(plannerViewAfterCreateRes.body?.mealPlans[0]?.weekId).toBe(weekId);
    expect(plannerViewAfterCreateRes.body?.mealPlans[0]?.id).toBe(
      createRes.body?.mealPlan?.id
    );
  });

  // UT - 15.02 — US.15 One plan per week (#161): 
  test("User cannot create a second meal plan for the same week", async () => {
    const unique = Date.now() + 1;
    const email = `weekly.duplicate.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;

    // Step 1: create and log in a user for this acceptance scenario.
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Duplicate",
      lastName: "Plan",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.token).toBeTruthy();

    // Step 2: user already has a meal plan for the target week.
    const firstCreateRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      },
    });

    expect(firstCreateRes.statusCode).toBe(201);
    expect(firstCreateRes.body?.success).toBe(true);

    // Step 3a and 3b: second create for same user/week is rejected with clear message.
    const duplicateCreateRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: "another",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      },
    });

    expect(duplicateCreateRes.statusCode).toBe(409);
    expect(duplicateCreateRes.body?.success).toBe(false);
    expect(duplicateCreateRes.body?.message).toBe(
      "A meal plan for this week already exists for this user."
    );

    // Step 3c: verify no second plan persists for this user/week.
    const mealPlansData = await fs.readFile(MEALPLANS_FILE, "utf8");
    const mealPlans = JSON.parse(mealPlansData);
    const matchingPlans = mealPlans.filter(
      (plan) => plan.userId === userId && plan.weekId === weekId
    );

    expect(matchingPlans).toHaveLength(1);

    const plannerViewRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerViewRes.statusCode).toBe(200);
    expect(plannerViewRes.body?.success).toBe(true);
    expect(plannerViewRes.body?.count).toBe(1);
    expect(plannerViewRes.body?.mealPlans[0]?.id).toBe(firstCreateRes.body?.mealPlan?.id);
  });
});
