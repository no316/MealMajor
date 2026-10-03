import request from "supertest";
import app, { initializeDataFile } from "../../../src/server.js";

beforeAll(async () => {
  await initializeDataFile();
});

describe("AT - Login (US.02)", () => {
  test("Submitting empty login form returns 400", async () => {
    const res = await request(app).post("/api/login").send({});
    expect(res.statusCode).toBe(400);
  });

  test("Invalid credentials returns 401", async () => {
    const res = await request(app)
      .post("/api/login")
      .send({ email: "notfound@example.com", password: "wrongpass" });
    expect(res.statusCode).toBe(401);
  });
});