import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const apiSource = read("src/api.ts");
const appSource = read("src/PlatformAdminApp.tsx");

for (const apiPath of [
  "/api/web-admin/session",
  "/api/web-admin/teacher-accounts",
  "/disable",
  "/enable",
  "/reset-password",
]) {
  assert.ok(apiSource.includes(apiPath), `web-admin API client should include ${apiPath}`);
}

for (const operation of [
  "createTeacherAccount",
  "patchTeacherAccount",
  "disableTeacherAccount",
  "enableTeacherAccount",
  "deleteTeacherAccount",
  "resetTeacherPassword",
]) {
  assert.ok(apiSource.includes(`function ${operation}`), `web-admin API client should expose ${operation}`);
  assert.ok(appSource.includes(operation), `web-admin workbench should use ${operation}`);
}

for (const forbidden of [
  "/api/admin",
  "/api/student",
  "/overview",
  "/classes",
  "/experiments",
  "/videos",
  "/question-banks",
  "/learning-assistant",
  "LearningAssistant",
  "QuestionBanksPage",
  "CatalogTreeWorkspacePage",
]) {
  assert.ok(!apiSource.includes(forbidden), `web-admin API client must not include ${forbidden}`);
  assert.ok(!appSource.includes(forbidden), `web-admin workbench must not include ${forbidden}`);
}

assert.ok(appSource.includes("TeacherAccountWorkbench"), "web-admin should keep the teacher account workbench");
assert.ok(appSource.includes("enableMutation"), "web-admin should expose an enable flow");
assert.ok(appSource.includes("deleteMutation"), "web-admin should expose a delete flow");
