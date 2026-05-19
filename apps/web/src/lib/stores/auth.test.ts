import { describe, expect, it } from "vitest";

import { ApiError } from "$lib/api/client";
import { getAuthHeaders, isRole } from "./auth";

describe("auth helpers", () => {
  it("recognizes valid roles", () => {
    expect(isRole("student")).toBe(true);
    expect(isRole("instructor")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("guest")).toBe(false);
  });

  it("does not leak auth headers outside the browser", () => {
    expect(getAuthHeaders()).toEqual({});
  });

  it("captures api error metadata", () => {
    const error = new ApiError("bad request", 401, {
      success: false,
      error: "nope",
      field: "auth",
    });

    expect(error.message).toBe("bad request");
    expect(error.status).toBe(401);
    expect(error.payload).toEqual({
      success: false,
      error: "nope",
      field: "auth",
    });
  });
});
