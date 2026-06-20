import { describe, expect, it } from "vitest";

import loginPageSource from "./auth/LoginPage.tsx?raw";
import requireAdminSource from "./auth/RequireAdmin.tsx?raw";
import navSource from "./nav.tsx?raw";
import { adminNavItemsForRole, selectedAdminNavKey } from "./nav";
import { adminDefaultRoute, adminRoutes } from "./routes";

const teacherWorkflowPaths = [
  "/overview",
  "/classes",
  "/experiments",
  "/videos",
  "/question-banks",
  "/analytics",
  "/feedback",
  "/learning-assistant",
  "/settings",
  "/ai-config",
];

describe("teacher console role boundaries", () => {
  it("exposes the same complete teacher workflow menu to every teacher account role", () => {
    expect(adminRoutes.map((route) => route.path)).toEqual(teacherWorkflowPaths);
    expect(adminNavItemsForRole("admin").map((item) => item.key)).toEqual(teacherWorkflowPaths);
    expect(adminNavItemsForRole("teacher").map((item) => item.key)).toEqual(teacherWorkflowPaths);
    expect(navSource).not.toContain("filter(");
    expect(navSource).not.toContain('role === "admin"');
    expect(selectedAdminNavKey("/learning-assistant", "teacher")).toBe("/learning-assistant");
    expect(selectedAdminNavKey("/ai-config", "teacher")).toBe("/ai-config");
    expect(selectedAdminNavKey("/unknown", "teacher")).toBe(adminDefaultRoute);
  });

  it("keeps non-teacher account roles out at login and authenticated route guards", () => {
    expect(loginPageSource).toContain('response.user.role !== "admin" && response.user.role !== "teacher"');
    expect(requireAdminSource).toContain('meQuery.data.role !== "admin" && meQuery.data.role !== "teacher"');
    expect(loginPageSource).not.toContain('response.user.role === "admin"');
    expect(requireAdminSource).not.toContain('meQuery.data.role === "admin"');
  });
});
