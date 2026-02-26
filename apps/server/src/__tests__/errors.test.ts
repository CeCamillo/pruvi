import { describe, expect, it } from "vitest";

import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../errors.js";

describe("AppError", () => {
  it("carries statusCode and code", () => {
    const error = new AppError("something broke", 500, "INTERNAL");

    expect(error.message).toBe("something broke");
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe("INTERNAL");
  });

  it("extends Error", () => {
    const error = new AppError("test", 500, "TEST");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
  });
});

describe("NotFoundError", () => {
  it("defaults to 404 with resource name", () => {
    const error = new NotFoundError("Question");

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Question not found");
  });

  it("includes id when provided", () => {
    const error = new NotFoundError("Question", 42);

    expect(error.message).toBe("Question with id 42 not found");
  });
});

describe("ValidationError", () => {
  it("defaults to 400", () => {
    const error = new ValidationError("Invalid email");

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Invalid email");
  });
});

describe("UnauthorizedError", () => {
  it("defaults to 401 with default message", () => {
    const error = new UnauthorizedError();

    expect(error.statusCode).toBe(401);
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.message).toBe("Unauthorized");
  });
});

describe("ForbiddenError", () => {
  it("defaults to 403 with default message", () => {
    const error = new ForbiddenError();

    expect(error.statusCode).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("Forbidden");
  });
});

describe("ConflictError", () => {
  it("defaults to 409", () => {
    const error = new ConflictError("Email already exists");

    expect(error.statusCode).toBe(409);
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("Email already exists");
  });
});
