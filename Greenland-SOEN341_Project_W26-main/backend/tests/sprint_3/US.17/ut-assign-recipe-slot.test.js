import request from "supertest";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";

describe("US 17 - Assign Recipe to Specific Day and Meal Type", () => {
  beforeAll(async () => {
    await initializeDataFile();
    await initializeMealPlansFile();
  });

  // UT - 17.01 — assign a recipe to selected day/meal slot (#162)
  test("User assigns a recipe to a day/meal slot and sees the updated planner data", async () => {
    const unique = Date.now();
    const email = `weekly.assign.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;

    const selectedDay = "wednesday";
    const selectedMeal = "dinner";
    const selectedRecipe = "Teriyaki Chicken Bowl";

    // Step 1: register and login, ensure a weekly plan already exists.
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Assign",
      lastName: "Recipe",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);

    const createPlanRes = await request(app).post("/api/mealplans").send({
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

    expect(createPlanRes.statusCode).toBe(201);
    expect(createPlanRes.body?.success).toBe(true);

    // Step 1: load existing weekly plan.
    const plannerLoadRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerLoadRes.statusCode).toBe(200);
    expect(plannerLoadRes.body?.success).toBe(true);
    expect(plannerLoadRes.body?.count).toBe(1);

    const planId = plannerLoadRes.body?.mealPlans?.[0]?.id;
    expect(planId).toBeTruthy();

    // Step 2: assign recipe to the chosen day and meal slot, and save.
    const assignRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({
        day: selectedDay,
        meal: selectedMeal,
        value: selectedRecipe,
      });

    // Step 3a and 3b: backend persists assignment and returns updated plan immediately.
    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.body?.success).toBe(true);
    expect(assignRes.body?.mealPlan).toBeDefined();
    expect(assignRes.body?.mealPlan?.days?.[selectedDay]?.[selectedMeal]).toBe(selectedRecipe);

    // explicit reload of planner still shows the new assignment.
    const plannerReloadRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerReloadRes.statusCode).toBe(200);
    expect(plannerReloadRes.body?.success).toBe(true);
    expect(plannerReloadRes.body?.count).toBe(1);

    const reloadedPlan = plannerReloadRes.body?.mealPlans?.[0];

    // Step 3c: assignment matches the selected day and meal type.
    expect(reloadedPlan?.days?.[selectedDay]?.[selectedMeal]).toBe(selectedRecipe);

    // Neighboring slots remain unchanged.
    expect(reloadedPlan?.days?.wednesday?.lunch).toBe("");
    expect(reloadedPlan?.days?.thursday?.dinner).toBe("");
  });

  // UT-17.2 — US.17 Assign recipe (persistence) (#163)
  test("Assigned recipe persists after reload and backend/UI data stay consistent", async () => {
    const unique = Date.now() + 1;
    const email = `weekly.persist.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;
    const otherWeekId = `2026-W${String(((unique + 1) % 40) + 10).padStart(2, "0")}`;

    const selectedDay = "monday";
    const selectedMeal = "lunch";
    const selectedRecipe = "Chickpea Pasta Salad";

    // Step 1: register and login, create multiple weekly plans and assign meals.
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Persist",
      lastName: "Check",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);

    // Existing weekly plan that will receive the assignment.
    const createTargetPlanRes = await request(app).post("/api/mealplans").send({
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

    expect(createTargetPlanRes.statusCode).toBe(201);

    // Another week exists to simulate navigation away from target week.
    const createOtherPlanRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId: otherWeekId,
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

    expect(createOtherPlanRes.statusCode).toBe(201);

    const loadTargetWeekRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(loadTargetWeekRes.statusCode).toBe(200);
    expect(loadTargetWeekRes.body?.success).toBe(true);
    expect(loadTargetWeekRes.body?.count).toBe(1);

    const planId = loadTargetWeekRes.body?.mealPlans?.[0]?.id;
    expect(planId).toBeTruthy();

    // User assigns recipe and saves successfully.
    const assignRes = await request(app)
      .patch(`/api/mealplans/${planId}/slot`)
      .send({ day: selectedDay, meal: selectedMeal, value: selectedRecipe });

    expect(assignRes.statusCode).toBe(200);
    expect(assignRes.body?.success).toBe(true);
    expect(assignRes.body?.mealPlan?.days?.[selectedDay]?.[selectedMeal]).toBe(selectedRecipe);

    // Step 2: Navigate away and return by loading another week then original week.
    const navigateAwayRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId: otherWeekId });

    expect(navigateAwayRes.statusCode).toBe(200);
    expect(navigateAwayRes.body?.success).toBe(true);
    expect(navigateAwayRes.body?.count).toBe(1);

    const returnToWeekRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    // Step 3a: System loads saved plan.
    expect(returnToWeekRes.statusCode).toBe(200);
    expect(returnToWeekRes.body?.success).toBe(true);
    expect(returnToWeekRes.body?.count).toBe(1);

    const returnedPlan = returnToWeekRes.body?.mealPlans?.[0];

    // Step 3b: Same recipe appears in same day and meal slot.
    expect(returnedPlan?.days?.[selectedDay]?.[selectedMeal]).toBe(selectedRecipe);

    // Step 3c: Backend state from save response and later planner load remain consistent.
    expect(returnedPlan?.id).toBe(assignRes.body?.mealPlan?.id);
    expect(returnedPlan?.days?.[selectedDay]?.[selectedMeal]).toBe(
      assignRes.body?.mealPlan?.days?.[selectedDay]?.[selectedMeal]
    );
  });
});
