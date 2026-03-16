import { describe, expect, it } from "vitest";
import {
  AppError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors";

describe("AppError", () => {
  it("creates an error with message, statusCode, and code", () => {
    const error = new AppError("something broke", 500, "INTERNAL_ERROR");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe("something broke");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.name).toBe("AppError");
  });
});

describe("NotFoundError", () => {
  it("defaults to 404 and NOT_FOUND code", () => {
    const error = new NotFoundError("user not found");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.name).toBe("NotFoundError");
  });
});

describe("ValidationError", () => {
  it("defaults to 400 and VALIDATION_ERROR code", () => {
    const error = new ValidationError("invalid email");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401 and UNAUTHORIZED code", () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Unauthorized");
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403 and FORBIDDEN code", () => {
    const error = new ForbiddenError();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("DatabaseError", () => {
  it("defaults to 500 and DATABASE_ERROR code", () => {
    const error = new DatabaseError("connection failed");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("DATABASE_ERROR");
  });
});
