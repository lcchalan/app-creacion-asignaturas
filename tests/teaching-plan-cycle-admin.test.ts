import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const server = fs.readFileSync("src/index.ts", "utf8");
const app = fs.readFileSync("public/app.js", "utf8");

test("ADMIN cierra un ciclo sin borrar ni alterar el workflow histórico", () => {
  const start = server.indexOf("const teachingPlanCycleCloseAdminMatch");
  const end = server.indexOf("const teachingPlanCycleEnableNextAdminMatch", start);
  assert.ok(start >= 0 && end > start);
  const block = server.slice(start, end);
  assert.ok(block.includes("if (!isAdmin(admin))"));
  assert.ok(block.includes("administrativelyClosedAt: closedAt"));
  assert.ok(block.includes("administrativelyClosedById: admin.id"));
  assert.ok(block.includes("administrativeCloseReason: body.reason"));
  assert.ok(block.includes("TEACHING_PLAN_CYCLE_ADMIN_CLOSED"));
  assert.ok(!block.includes("teachingPlanReviewWorkflow.update"));
  assert.ok(!block.includes('status: "CANCELLED"'));
  assert.ok(!block.includes("currentTeachingPlanId: null"));
});

test("habilitar un nuevo ciclo exige cierre previo y protege una Guía ya iniciada", () => {
  const start = server.indexOf("const teachingPlanCycleEnableNextAdminMatch");
  const end = server.indexOf('if (request.method === "GET" && requestUrl.pathname === "/api/admin/academic-offer/template")', start);
  assert.ok(start >= 0 && end > start);
  const block = server.slice(start, end);
  assert.ok(block.includes("TEACHING_PLAN_CYCLE_NOT_CLOSED"));
  assert.ok(block.includes("TEACHING_PLAN_CYCLE_GUIDE_ALREADY_STARTED"));
  assert.ok(block.includes("currentTeachingPlanId: null"));
  assert.ok(block.includes("currentStep: 4"));
  assert.ok(block.includes("TEACHING_PLAN_NEXT_CYCLE_ENABLED"));
});

test("un ciclo cerrado administrativamente queda bloqueado para edición docente", () => {
  const start = server.indexOf("async function assertTeachingPlanTeacherCanEdit");
  const end = server.indexOf("async function assertTeachingPlanInstitutionallyApproved", start);
  assert.ok(start >= 0 && end > start);
  const block = server.slice(start, end);
  assert.ok(block.includes("administrativelyClosedAt"));
  assert.ok(block.includes("TEACHING_PLAN_CYCLE_ADMIN_CLOSED"));
});

test("dashboard expone Plan actual e historial de ciclos", () => {
  assert.ok(server.includes("currentTeachingPlanId: true"));
  assert.ok(server.includes("teachingPlans: {"));
  assert.ok(server.includes('orderBy: { cycleNumber: "desc" }'));
  assert.ok(server.includes("administrativelyClosedBy:"));
});

test("Administración muestra cerrar, habilitar e historial sin borrar ciclos", () => {
  assert.ok(app.includes("function closeTeachingPlanCycleAdminV33062"));
  assert.ok(app.includes("function enableNextTeachingPlanCycleAdminV33062"));
  assert.ok(app.includes("Cerrar proceso"));
  assert.ok(app.includes("Habilitar nuevo ciclo"));
  assert.ok(app.includes("Historial de ciclos"));
  assert.ok(app.includes("Nuevo ciclo habilitado"));
});
