import { createHash } from "node:crypto";

export const AI_GENERATION_LIMIT_SETTING_KEY = "AI_MAX_GENERATIONS_PER_CONTENT";
export const DEFAULT_AI_GENERATION_LIMIT = 3;
export const MAX_CONFIGURABLE_AI_GENERATION_LIMIT = 100;
export const AI_JOB_MAX_TECHNICAL_RETRIES = 3;

export type AiGenerationDescriptor = {
  operation: string;
  targetKey: string;
  projectId: string | null;
  label: string;
};

function bodyRecord(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.parseInt(String(value || ""), 10);
}

function shortHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 24);
}

export function managedAiPath(method: string | undefined, pathname: string) {
  if ((method || "").toUpperCase() !== "POST") return false;
  return pathname === "/api/bibliography/apa-review" ||
    pathname === "/api/generate-week" ||
    pathname === "/api/generate-visual" ||
    pathname === "/api/generate-assisted-resource" ||
    /^\/api\/projects\/[0-9a-f-]+\/adaptation\/analyze$/iu.test(pathname) ||
    /^\/api\/projects\/[0-9a-f-]+\/microcurricular-presentation\/generate$/iu.test(pathname) ||
    /^\/api\/projects\/[0-9a-f-]+\/teaching-plan\/generate$/iu.test(pathname) ||
    /^\/api\/projects\/[0-9a-f-]+\/teaching-plan\/question-banks\/AC[1-5]\/generate$/iu.test(pathname) ||
    /^\/api\/projects\/[0-9a-f-]+\/teaching-plan\/question-banks\/AC[1-5]\/questions\/[0-9a-f-]+\/regenerate$/iu.test(pathname);
}

export function describeManagedAiRequest(
  method: string | undefined,
  pathname: string,
  body: unknown,
): AiGenerationDescriptor | null {
  if (!managedAiPath(method, pathname)) return null;
  const data = bodyRecord(body);

  if (pathname === "/api/bibliography/apa-review") {
    const sourceFingerprint = shortHash({
      citation: stringValue(data.citation),
      title: stringValue(data.title),
      url: stringValue(data.url),
    });
    return {
      operation: "BIBLIOGRAPHY_APA_REVIEW",
      targetKey: `bibliography:${sourceFingerprint}`,
      projectId: null,
      label: "Revisión APA con IA",
    };
  }

  if (pathname === "/api/generate-week") {
    const projectId = stringValue(data.projectId);
    const week = numberValue(data.week);
    return {
      operation: "GUIDE_WEEK_GENERATION",
      targetKey: `project:${projectId || "unsaved"}:guide-week:${Number.isInteger(week) ? week : "unknown"}`,
      projectId: projectId || null,
      label: `Generación de Guía Didáctica${Number.isInteger(week) ? ` · semana ${week}` : ""}`,
    };
  }

  if (pathname === "/api/generate-visual") {
    const projectId = stringValue(data.projectId);
    const week = numberValue(data.week);
    const proposal = bodyRecord(data.proposal);
    const proposalId = stringValue(proposal.id) || shortHash(proposal);
    return {
      operation: "GUIDE_IMAGE_GENERATION",
      targetKey: `project:${projectId || "unsaved"}:guide-image:${Number.isInteger(week) ? week : "unknown"}:${proposalId}`,
      projectId: projectId || null,
      label: "Generación de recurso visual con IA",
    };
  }

  if (pathname === "/api/generate-assisted-resource") {
    const projectId = stringValue(data.projectId);
    const week = numberValue(data.week);
    const proposal = bodyRecord(data.proposal);
    const proposalId = stringValue(proposal.id) || shortHash(proposal);
    return {
      operation: "GUIDE_ASSISTED_RESOURCE_GENERATION",
      targetKey: `project:${projectId || "unsaved"}:guide-resource:${Number.isInteger(week) ? week : "unknown"}:${proposalId}`,
      projectId: projectId || null,
      label: "Generación de recurso educativo con IA",
    };
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([0-9a-f-]+)\/(.+)$/iu);
  const projectId = projectMatch?.[1] || null;
  const suffix = projectMatch?.[2] || "";

  if (projectId && suffix === "teaching-plan/generate") {
    return {
      operation: "TEACHING_PLAN_GENERATION",
      targetKey: `project:${projectId}:teaching-plan`,
      projectId,
      label: "Generación del Plan Docente",
    };
  }

  if (projectId && suffix === "microcurricular-presentation/generate") {
    return {
      operation: "MICROCURRICULAR_PRESENTATION_GENERATION",
      targetKey: `project:${projectId}:microcurricular-presentation`,
      projectId,
      label: "Generación de presentación de la asignatura",
    };
  }

  const questionBankGenerate = suffix.match(/^teaching-plan\/question-banks\/(AC[1-5])\/generate$/iu);
  if (projectId && questionBankGenerate) {
    const code = questionBankGenerate[1]!.toUpperCase();
    return {
      operation: "TEACHING_PLAN_QUESTION_BANK_GENERATION",
      targetKey: `project:${projectId}:question-bank:${code}`,
      projectId,
      label: `Generación de banco de preguntas · ${code}`,
    };
  }

  const questionRegenerate = suffix.match(/^teaching-plan\/question-banks\/(AC[1-5])\/questions\/([0-9a-f-]+)\/regenerate$/iu);
  if (projectId && questionRegenerate) {
    const code = questionRegenerate[1]!.toUpperCase();
    const questionId = questionRegenerate[2]!;
    return {
      operation: "TEACHING_PLAN_QUESTION_REGENERATION",
      targetKey: `project:${projectId}:question-bank:${code}:question:${questionId}`,
      projectId,
      label: `Regeneración de pregunta · ${code}`,
    };
  }

  if (projectId && suffix === "adaptation/analyze") {
    const target = stringValue(data.target).toUpperCase() || "UNKNOWN";
    return {
      operation: target === "GUIDE" ? "GUIDE_ADAPTATION_ANALYSIS" : "TEACHING_PLAN_ADAPTATION_ANALYSIS",
      targetKey: `project:${projectId}:adaptation:${target}`,
      projectId,
      label: target === "GUIDE" ? "Análisis de adaptación de la Guía Didáctica" : "Análisis de adaptación del Plan Docente",
    };
  }

  return null;
}

export function normalizeAiGenerationLimit(value: unknown, fallback = DEFAULT_AI_GENERATION_LIMIT) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_CONFIGURABLE_AI_GENERATION_LIMIT) return fallback;
  return parsed;
}

export function aiUsageSnapshot(limit: number, used: number, reserved = 0) {
  const normalizedLimit = normalizeAiGenerationLimit(limit);
  const normalizedUsed = Math.max(0, Math.trunc(used));
  const normalizedReserved = Math.max(0, Math.trunc(reserved));
  const unlimited = normalizedLimit === 0;
  const occupied = normalizedUsed + normalizedReserved;
  return {
    limit: normalizedLimit,
    used: normalizedUsed,
    reserved: normalizedReserved,
    unlimited,
    remaining: unlimited ? null : Math.max(0, normalizedLimit - occupied),
    canRequest: unlimited || occupied < normalizedLimit,
  };
}
