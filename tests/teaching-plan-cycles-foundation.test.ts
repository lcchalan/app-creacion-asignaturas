import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const server = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../prisma/migrations/20260823234500_v33_0_6_1_teaching_plan_cycles/migration.sql", import.meta.url), "utf8");

test("el proyecto conserva un Plan actual y permite varios ciclos historicos", () => {
  assert.match(schema, /currentTeachingPlanId\s+String\?\s+@unique/);
  assert.match(schema, /teachingPlan\s+TeachingPlan\?\s+@relation\("CurrentTeachingPlan"/);
  assert.match(schema, /teachingPlans\s+TeachingPlan\[\]\s+@relation\("TeachingPlanProject"\)/);
  assert.match(schema, /cycleNumber\s+Int\s+@default\(1\)/);
  assert.match(schema, /@@unique\(\[projectId, cycleNumber\]\)/);
  const teachingPlanModel = schema.match(/model TeachingPlan \{[\s\S]*?\n\}/)?.[0] || "";
  assert.ok(teachingPlanModel, "No se encontro model TeachingPlan en schema.prisma");
  assert.doesNotMatch(teachingPlanModel, /projectId\s+String\s+@unique\s+@db\.Uuid/);
});

test("la migracion convierte los Planes existentes en ciclo 1 y enlaza el Plan actual", () => {
  assert.match(migration, /UPDATE "Project" AS project[\s\S]*SET "currentTeachingPlanId" = plan\."id"/);
  assert.match(migration, /DROP INDEX IF EXISTS "TeachingPlan_projectId_key"/);
  assert.match(migration, /TeachingPlan_projectId_cycleNumber_key/);
  assert.match(migration, /Project_currentTeachingPlanId_fkey/);
});

test("la generacion actualiza solo el ciclo actual y crea el siguiente cuando no existe", () => {
  assert.doesNotMatch(server, /teachingPlan\.upsert\(\{[\s\S]{0,300}where:\s*\{\s*projectId:/);
  assert.doesNotMatch(server, /teachingPlan\.findUnique\(\{\s*where:\s*\{\s*projectId:/);
  assert.match(server, /orderBy:\s*\{\s*cycleNumber:\s*"desc"\s*\}/);
  assert.match(server, /currentTeachingPlanId:\s*created\.id/);
});

test("la ficha base nunca elimina todos los ciclos historicos", () => {
  assert.doesNotMatch(server, /teachingPlan\.deleteMany\(\{\s*where:\s*\{\s*projectId:\s*project\.id/);
  assert.match(server, /PLAN_DOCENTE_CICLO_INSTITUCIONAL/);
  assert.match(server, /teachingPlan\.delete\(\{\s*where:\s*\{\s*id:\s*project\.teachingPlan\.id/);
});

test("el esquema deja preparados cierre administrativo y reutilizacion sin alterar el estado academico", () => {
  assert.match(schema, /administrativelyClosedAt\s+DateTime\?/);
  assert.match(schema, /administrativeCloseReason\s+String\?/);
  assert.match(schema, /reusedFromTeachingPlanId\s+String\?/);
  assert.match(schema, /TeachingPlanAdministrativelyClosedBy/);
  assert.match(schema, /TeachingPlanReuse/);
});
