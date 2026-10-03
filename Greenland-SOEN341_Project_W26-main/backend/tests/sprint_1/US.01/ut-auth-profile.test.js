import request from "supertest";
import app, { initializeDataFile } from "../../../src/server.js";

beforeAll(async () => {
  await initializeDataFile();
});

describe("AT - Auth + Profile + Diet/Allergies", () => {
  test("Register, login, profile retrieval, update diet + allergies works", async () => {
    const now = Date.now();
    const email = `user${now}@example.com`;
    const password = "StrongPass!234";

    // Register new user
    const registerRes = await request(app).post("/api/register").send({
      firstName: "Auth",
      lastName: "Tester",
      email,
      password,
    });

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.user).toBeDefined();
    expect(registerRes.body.user.email).toBe(email);

    const userId = registerRes.body.user.id;
    expect(userId).toBeTruthy();

    // Login with the same credentials
    const loginRes = await request(app).post("/api/login").send({
      email,
      password,
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeTruthy();
    expect(loginRes.body.user).toBeDefined();
    expect(loginRes.body.user.id).toBe(userId);

    // Retrieve profile
    const profileRes = await request(app).get(`/api/profile/${userId}`);
    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.user).toBeDefined();
    expect(profileRes.body.user.email).toBe(email);

    // Update diet preference and allergies
    const updateRes = await request(app)
      .patch(`/api/profile/${userId}`)
      .send({ dietPreference: "non-vegetarian", allergies: ["gluten", "peanuts"] });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.user.dietPreference).toBe("non-vegetarian");
    expect(updateRes.body.user.allergies).toEqual(["gluten", "peanuts"]);

    // Confirm persisted via profile endpoint
    const updatedProfileRes = await request(app).get(`/api/profile/${userId}`);
    expect(updatedProfileRes.statusCode).toBe(200);
    expect(updatedProfileRes.body.success).toBe(true);
    expect(updatedProfileRes.body.user.dietPreference).toBe("non-vegetarian");
    expect(updatedProfileRes.body.user.allergies).toEqual(["gluten", "peanuts"]);
  });
});
