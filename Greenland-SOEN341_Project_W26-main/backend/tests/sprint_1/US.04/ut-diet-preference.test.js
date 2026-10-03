import request from "supertest";
import app, { initializeDataFile } from "../../../src/server.js";

beforeAll(async () => {
  await initializeDataFile();
});

describe("AT - Diet Preferences (US.04)", () => {
  test("Diet preference persists after update", async () => {
    //Register a new user (unique email so test can re-run)
    const email = `test${Date.now()}@example.com`;

    const reg = await request(app).post("/api/register").send({
      firstName: "Test",
      lastName: "User",
      email,
      password: "password123",
    });

    expect(reg.statusCode).toBe(201);
    const userId = reg.body?.user?.id;
    expect(userId).toBeTruthy();

    //Update diet preference
    const patch = await request(app)
      .patch(`/api/profile/${userId}`)
      .send({ dietPreference: "vegan" });

    expect(patch.statusCode).toBe(200);
    expect(patch.body?.user?.dietPreference).toBe("vegan");

    //Fetch profile and confirm it persisted
    const profile = await request(app).get(`/api/profile/${userId}`);

    expect(profile.statusCode).toBe(200);
    expect(profile.body?.user?.dietPreference).toBe("vegan");
  });
});