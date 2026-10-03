import request from "supertest";
import app, { initializeDataFile, initializeMealPlansFile } from "../../../src/server.js";

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const REQUIRED_GRID_SLOTS = ["breakfast", "lunch", "dinner"];

describe("US 16 - View Weekly Grid", () => {
  beforeAll(async () => {
    await initializeDataFile();
    await initializeMealPlansFile();
  });

  // UT - 16.01 — US.16 View existing weekly plan in planner grid (#159)
  test("Logged-in user opens planner and sees assigned meals in correct day/meal cells", async () => {
    const unique = Date.now();
    const email = `weekly.viewer.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;

    // Step 1: create user and log in.
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Planner",
      lastName: "Viewer",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    expect(loginRes.body?.token).toBeTruthy();

    // user already has an existing meal plan with assigned meals.
    const createPlanRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: {
          breakfast: "Overnight Oats",
          lunch: "",
          dinner: "",
          snack: "",
        },
        tuesday: {
          breakfast: "",
          lunch: "Chicken Wrap",
          dinner: "",
          snack: "",
        },
        wednesday: {
          breakfast: "",
          lunch: "",
          dinner: "",
          snack: "",
        },
        thursday: {
          breakfast: "",
          lunch: "",
          dinner: "Salmon Bowl",
          snack: "",
        },
        friday: {
          breakfast: "Yogurt Parfait",
          lunch: "",
          dinner: "",
          snack: "",
        },
        saturday: {
          breakfast: "",
          lunch: "",
          dinner: "",
          snack: "",
        },
        sunday: {
          breakfast: "",
          lunch: "",
          dinner: "",
          snack: "",
        },
      },
    });

    expect(createPlanRes.statusCode).toBe(201);
    expect(createPlanRes.body?.success).toBe(true);

    // Step 2 and 3a: user opens weekly planner, system loads plan from backend.
    const plannerLoadRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerLoadRes.statusCode).toBe(200);
    expect(plannerLoadRes.body?.success).toBe(true);
    expect(plannerLoadRes.body?.count).toBe(1);

    const loadedPlan = plannerLoadRes.body?.mealPlans?.[0];
    expect(loadedPlan).toBeDefined();
    expect(loadedPlan.userId).toBe(userId);
    expect(loadedPlan.weekId).toBe(weekId);

    // Step 3b: UI grid contract is satisfied, 7 day columns and defined meal slots.
    const loadedDays = loadedPlan.days;
    expect(loadedDays).toBeDefined();

    DAY_KEYS.forEach((dayKey) => {
      expect(loadedDays[dayKey]).toBeDefined();
      REQUIRED_GRID_SLOTS.forEach((slotKey) => {
        expect(Object.prototype.hasOwnProperty.call(loadedDays[dayKey], slotKey)).toBe(true);
      });
    });

    // Step 3c: assigned recipes are returned in the correct day/meal cells.
    expect(loadedDays.monday.breakfast).toBe("Overnight Oats");
    expect(loadedDays.tuesday.lunch).toBe("Chicken Wrap");
    expect(loadedDays.thursday.dinner).toBe("Salmon Bowl");
    expect(loadedDays.friday.breakfast).toBe("Yogurt Parfait");
  });

  // UT - 16.02 — US.16 Empty slots (#165)
  test("Logged-in user opens planner with empty slots and grid remains intact", async () => {
    const unique = Date.now() + 1;
    const email = `weekly.empty.${unique}@example.com`;
    const password = "StrongPass!234";
    const weekId = `2026-W${String((unique % 40) + 10).padStart(2, "0")}`;

    // Step 1: create user and log in.
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Empty",
      lastName: "Slots",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    const userId = registerRes.body?.user?.id;
    expect(userId).toBeTruthy();

    const loginRes = await request(app).post("/api/login").send({ email, password });
    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body?.success).toBe(true);
    expect(loginRes.body?.token).toBeTruthy();

    // Weekly plan exists and some slots are filled in.
    const createPlanRes = await request(app).post("/api/mealplans").send({
      userId,
      weekId,
      days: {
        monday: { breakfast: "Oatmeal", lunch: "", dinner: "", snack: "" },
        tuesday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        wednesday: { breakfast: "", lunch: "", dinner: "Pasta", snack: "" },
        thursday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        friday: { breakfast: "", lunch: "Salad", dinner: "", snack: "" },
        saturday: { breakfast: "", lunch: "", dinner: "", snack: "" },
        sunday: { breakfast: "", lunch: "", dinner: "", snack: "" },
      },
    });

    expect(createPlanRes.statusCode).toBe(201);
    expect(createPlanRes.body?.success).toBe(true);

    // Step 2 and 3a: system loads plan successfully and no server error is returned.
    const plannerLoadRes = await request(app)
      .get("/api/mealplans")
      .query({ userId, weekId });

    expect(plannerLoadRes.statusCode).toBe(200);
    expect(plannerLoadRes.body?.success).toBe(true);
    expect(plannerLoadRes.body?.count).toBe(1);
    expect(plannerLoadRes.body?.message).toBeUndefined();

    const loadedPlan = plannerLoadRes.body?.mealPlans?.[0];
    expect(loadedPlan).toBeDefined();

    // Step 3b: all day rows and meal-type cells exist, including empty-state slots.
    const loadedDays = loadedPlan.days;
    DAY_KEYS.forEach((dayKey) => {
      expect(loadedDays[dayKey]).toBeDefined();
      REQUIRED_GRID_SLOTS.forEach((slotKey) => {
        expect(Object.prototype.hasOwnProperty.call(loadedDays[dayKey], slotKey)).toBe(true);
        expect(typeof loadedDays[dayKey][slotKey]).toBe("string");
      });
    });

    // Step 3c: Empty slots are explicit empty strings rather than missing/broken cells.
    expect(loadedDays.tuesday.breakfast).toBe("");
    expect(loadedDays.thursday.dinner).toBe("");
    expect(loadedDays.sunday.lunch).toBe("");

    // Assigned slots still render in the correct cells.
    expect(loadedDays.monday.breakfast).toBe("Oatmeal");
    expect(loadedDays.wednesday.dinner).toBe("Pasta");
    expect(loadedDays.friday.lunch).toBe("Salad");
  });
});
