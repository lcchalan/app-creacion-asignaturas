import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Prisma } from "@prisma/client";
import { database } from "../db/client.js";
import {
  AI_GENERATION_LIMIT_SETTING_KEY,
  AI_JOB_MAX_TECHNICAL_RETRIES,
  DEFAULT_AI_GENERATION_LIMIT,
  aiUsageSnapshot,
  describeManagedAiRequest,
  managedAiPath,
  normalizeAiGenerationLimit,
  type AiGenerationDescriptor,
} from "./ai-generation-policy.js";

const internalToken = randomBytes(32).toString("base64url");
const executionContext = new AsyncLocalStorage<{ jobId: string; remoteCallIndex: number }>();
const activeWorkers = new Set<string>();
let workerTimer: NodeJS.Timeout | null = null;
let recoveryTimer: NodeJS.Timeout | null = null;
let cleanupTimer: NodeJS.Timeout | null = null;

const INTERNAL_TOKEN_HEADER = "x-ai-internal-token";
const INTERNAL_JOB_HEADER = "x-ai-job-id";
const IDEMPOTENCY_HEADER = "x-ai-idempotency-key";

export type AiIngressResult = {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

function errorWithStatus(message: string, statusCode: number, code?: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function headerValue(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function safeIdempotencyKey(value: string) {
  const trimmed = value.trim();
  return /^[A-Za-z0-9._:-]{12,160}$/u.test(trimmed) ? trimmed : randomUUID();
}

export function internalAiJobIdFromRequest(request: IncomingMessage) {
  if (headerValue(request, INTERNAL_TOKEN_HEADER) !== internalToken) return null;
  const jobId = headerValue(request, INTERNAL_JOB_HEADER).trim();
  return /^[0-9a-f-]{36}$/iu.test(jobId) ? jobId : null;
}

export function isInternalAiRequest(request: IncomingMessage) {
  return Boolean(internalAiJobIdFromRequest(request));
}

export function enterAiJobExecution(jobId: string) {
  executionContext.enterWith({ jobId, remoteCallIndex: 0 });
}

export function currentAiJobId() {
  return executionContext.getStore()?.jobId || null;
}

export function nextAiRemoteCallKey(kind: "RESPONSES" | "IMAGES") {
  const context = executionContext.getStore();
  if (!context) return null;
  context.remoteCallIndex += 1;
  return `${kind}_${context.remoteCallIndex}`;
}

export async function resolveInternalAiUser(request: IncomingMessage) {
  const jobId = internalAiJobIdFromRequest(request);
  if (!jobId) return null;
  const job = await database.aiGenerationJob.findUnique({
    where: { id: jobId },
    include: { requestedBy: { include: { roles: { include: { role: true } } } } },
  });
  if (!job || !["RUNNING", "QUEUED"].includes(job.status) || !job.requestedBy.active) return null;
  return job.requestedBy;
}

export async function aiGenerationLimit() {
  const setting = await database.institutionalSetting.findUnique({
    where: { key: AI_GENERATION_LIMIT_SETTING_KEY },
    select: { value: true },
  });
  return normalizeAiGenerationLimit(setting?.value, DEFAULT_AI_GENERATION_LIMIT);
}

async function usageForTarget(requestedById: string, targetKey: string, limit?: number) {
  const [resolvedLimit, used, reserved] = await Promise.all([
    limit === undefined ? aiGenerationLimit() : Promise.resolve(limit),
    database.aiGenerationJob.count({
      where: { requestedById, targetKey, countsTowardLimit: true },
    }),
    database.aiGenerationJob.count({
      where: {
        requestedById,
        targetKey,
        quotaReserved: true,
        status: { in: ["QUEUED", "RUNNING"] },
      },
    }),
  ]);
  return aiUsageSnapshot(resolvedLimit, used, reserved);
}

function publicJobView(job: {
  id: string;
  operation: string;
  targetKey: string;
  idempotencyKey: string;
  status: string;
  responseStatus: number | null;
  responsePayload: unknown;
  errorMessage: string | null;
  technicalRetryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}, usage: Awaited<ReturnType<typeof usageForTarget>>) {
  return {
    id: job.id,
    operation: job.operation,
    targetKey: job.targetKey,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    responseStatus: job.responseStatus,
    responsePayload: job.responsePayload,
    errorMessage: job.errorMessage,
    technicalRetryCount: job.technicalRetryCount,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    terminal: ["COMPLETED", "FAILED", "CANCELLED"].includes(job.status),
    usage,
  };
}

async function createOrReuseJob(input: {
  requestedById: string;
  descriptor: AiGenerationDescriptor;
  idempotencyKey: string;
  requestMethod: string;
  requestPath: string;
  requestPayload: unknown;
}) {
  const requestHash = stableHash({
    method: input.requestMethod,
    path: input.requestPath,
    body: input.requestPayload,
  });
  const existing = await database.aiGenerationJob.findUnique({
    where: {
      requestedById_idempotencyKey: {
        requestedById: input.requestedById,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw errorWithStatus(
        "La clave de idempotencia ya fue utilizada con una solicitud de IA diferente.",
        409,
        "AI_IDEMPOTENCY_KEY_CONFLICT",
      );
    }
    return existing;
  }

  const activeSameTarget = await database.aiGenerationJob.findFirst({
    where: {
      requestedById: input.requestedById,
      activeTargetKey: input.descriptor.targetKey,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (activeSameTarget) {
    if (activeSameTarget.requestHash === requestHash) return activeSameTarget;
    throw errorWithStatus(
      "Ya existe una generación de IA en curso para este contenido. Espere a que finalice antes de solicitar una generación diferente.",
      409,
      "AI_GENERATION_ALREADY_RUNNING",
    );
  }

  const limit = await aiGenerationLimit();
  const usage = await usageForTarget(input.requestedById, input.descriptor.targetKey, limit);
  if (!usage.canRequest) {
    throw errorWithStatus(
      `Ha alcanzado el máximo de ${usage.limit} generaciones permitidas para este contenido. Contacte a Administración si requiere habilitar nuevas generaciones.`,
      429,
      "AI_GENERATION_LIMIT_REACHED",
    );
  }

  try {
    return await database.aiGenerationJob.create({
      data: {
        requestedById: input.requestedById,
        projectId: input.descriptor.projectId,
        operation: input.descriptor.operation,
        targetKey: input.descriptor.targetKey,
        activeTargetKey: input.descriptor.targetKey,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        requestMethod: input.requestMethod,
        requestPath: input.requestPath,
        requestPayload: (input.requestPayload ?? {}) as never,
        status: "QUEUED",
        quotaReserved: true,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const concurrent = await database.aiGenerationJob.findFirst({
      where: {
        requestedById: input.requestedById,
        OR: [
          { idempotencyKey: input.idempotencyKey },
          { activeTargetKey: input.descriptor.targetKey, status: { in: ["QUEUED", "RUNNING"] } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (concurrent?.requestHash === requestHash) return concurrent;
    throw errorWithStatus(
      "Ya existe una generación de IA en curso para este contenido.",
      409,
      "AI_GENERATION_ALREADY_RUNNING",
    );
  }
}

export async function maybeQueueManagedAiRequest(input: {
  request: IncomingMessage;
  pathname: string;
  readBody: () => Promise<unknown>;
  requireUser: () => Promise<{ id: string }>;
}): Promise<AiIngressResult | null> {
  if (isInternalAiRequest(input.request)) return null;
  if (!managedAiPath(input.request.method, input.pathname)) return null;

  const user = await input.requireUser();
  const body = await input.readBody();
  const descriptor = describeManagedAiRequest(input.request.method, input.pathname, body);
  if (!descriptor) return null;

  const idempotencyKey = safeIdempotencyKey(headerValue(input.request, IDEMPOTENCY_HEADER));
  const job = await createOrReuseJob({
    requestedById: user.id,
    descriptor,
    idempotencyKey,
    requestMethod: (input.request.method || "POST").toUpperCase(),
    requestPath: input.pathname,
    requestPayload: body,
  });
  const usage = await usageForTarget(user.id, descriptor.targetKey);
  return {
    status: 202,
    headers: {
      "X-AI-Job-Id": job.id,
      "Retry-After": "2",
    },
    body: {
      ok: true,
      code: "AI_JOB_QUEUED",
      message: "La solicitud de IA quedó registrada y continuará aunque se interrumpa la conexión del navegador.",
      job: publicJobView(job, usage),
    },
  };
}

export async function aiJobStatusForUser(jobId: string, userId: string, admin = false) {
  const job = await database.aiGenerationJob.findFirst({
    where: { id: jobId, ...(admin ? {} : { requestedById: userId }) },
  });
  if (!job) throw errorWithStatus("El trabajo de IA no existe o no pertenece al usuario.", 404, "AI_JOB_NOT_FOUND");
  const usage = await usageForTarget(job.requestedById, job.targetKey);
  return publicJobView(job, usage);
}

export async function recentAiJobsForAdmin(take = 50) {
  const jobs = await database.aiGenerationJob.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(200, take)),
    include: {
      requestedBy: { select: { id: true, displayName: true, email: true } },
      project: { select: { id: true, subjectCode: true, subjectName: true } },
    },
  });
  return jobs.map((job: any) => ({
    id: job.id,
    operation: job.operation,
    targetKey: job.targetKey,
    idempotencyKey: job.idempotencyKey,
    status: job.status,
    responseStatus: job.responseStatus,
    technicalRetryCount: job.technicalRetryCount,
    countsTowardLimit: job.countsTowardLimit,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
    requestedBy: job.requestedBy,
    project: job.project,
  }));
}

export function internalAiRequestHeaders(jobId: string) {
  return {
    [INTERNAL_TOKEN_HEADER]: internalToken,
    [INTERNAL_JOB_HEADER]: jobId,
    "Content-Type": "application/json",
  };
}

export async function heartbeatAiJob(jobId: string) {
  await database.aiGenerationJob.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: { lastHeartbeatAt: new Date() },
  });
}

function retryDelayMs(retryCount: number) {
  return Math.min(60_000, 2_000 * (2 ** Math.max(0, retryCount - 1)));
}

async function requeueOrFail(job: { id: string; technicalRetryCount: number }, message: string, responseStatus?: number, responsePayload?: unknown) {
  const nextRetry = job.technicalRetryCount + 1;
  if (nextRetry <= AI_JOB_MAX_TECHNICAL_RETRIES) {
    await database.aiGenerationJob.update({
      where: { id: job.id },
      data: {
        status: "QUEUED",
        technicalRetryCount: nextRetry,
        nextRetryAt: new Date(Date.now() + retryDelayMs(nextRetry)),
        errorMessage: message.slice(0, 10_000),
        responseStatus: responseStatus || null,
        responsePayload: responsePayload === undefined ? undefined : responsePayload as never,
        startedAt: null,
      },
    });
    return;
  }
  await database.aiGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "FAILED",
      technicalRetryCount: nextRetry,
      errorMessage: message.slice(0, 10_000),
      responseStatus: responseStatus || 503,
      responsePayload: (responsePayload ?? { error: message }) as never,
      quotaReserved: false,
      countsTowardLimit: false,
      activeTargetKey: null,
      requestPayload: Prisma.DbNull,
      completedAt: new Date(),
    },
  });
}

async function processJob(baseUrl: string, jobId: string) {
  const job = await database.aiGenerationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "RUNNING") return;
  activeWorkers.add(job.id);
  const leaseHeartbeat = setInterval(() => {
    void heartbeatAiJob(job.id).catch((error) => console.error("No fue posible renovar el trabajo IA activo:", error));
  }, 10_000);
  leaseHeartbeat.unref();
  try {
    const requestBody = job.requestPayload === null || job.requestPayload === undefined
      ? undefined
      : JSON.stringify(job.requestPayload);
    const result = await fetch(`${baseUrl}${job.requestPath}`, {
      method: job.requestMethod,
      headers: internalAiRequestHeaders(job.id),
      body: requestBody,
    });
    const text = await result.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }

    if (result.ok) {
      await database.aiGenerationJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          responseStatus: result.status,
          responsePayload: (payload ?? {}) as never,
          errorMessage: null,
          quotaReserved: false,
          countsTowardLimit: true,
          activeTargetKey: null,
          requestPayload: Prisma.DbNull,
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          nextRetryAt: null,
        },
      });
      return;
    }

    const publicError = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).error === "string"
      ? String((payload as Record<string, unknown>).error)
      : `La operación de IA terminó con HTTP ${result.status}.`;
    if (result.status === 429 || result.status >= 500) {
      await requeueOrFail(job, publicError, result.status, payload);
      return;
    }
    await database.aiGenerationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        responseStatus: result.status,
        responsePayload: (payload ?? { error: publicError }) as never,
        errorMessage: publicError.slice(0, 10_000),
        quotaReserved: false,
        countsTowardLimit: false,
        activeTargetKey: null,
        requestPayload: Prisma.DbNull,
        completedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await requeueOrFail(job, message);
  } finally {
    clearInterval(leaseHeartbeat);
    activeWorkers.delete(job.id);
  }
}

async function claimNextJob(baseUrl: string) {
  if (activeWorkers.size >= 2) return;
  const now = new Date();
  const candidate = await database.aiGenerationJob.findFirst({
    where: {
      status: "QUEUED",
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return;
  const claimed = await database.aiGenerationJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: {
      status: "RUNNING",
      startedAt: now,
      lastHeartbeatAt: now,
      nextRetryAt: null,
    },
  });
  if (claimed.count !== 1) return;
  void processJob(baseUrl, candidate.id);
}

async function recoverInterruptedJobs() {
  const staleBefore = new Date(Date.now() - 45_000);
  await database.aiGenerationJob.updateMany({
    where: {
      status: "RUNNING",
      OR: [{ lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }],
    },
    data: {
      status: "QUEUED",
      startedAt: null,
      nextRetryAt: new Date(),
      errorMessage: "El proceso que ejecutaba este trabajo dejó de renovar su estado. La cola lo reanudará desde la información persistida.",
    },
  });
}

async function cleanupOldJobs() {
  const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await database.aiGenerationRemoteCall.deleteMany({
    where: { job: { completedAt: { lt: before } } },
  });
  await database.aiGenerationJob.updateMany({
    where: { completedAt: { lt: before }, status: { in: ["COMPLETED", "FAILED", "CANCELLED"] } },
    data: { requestPayload: Prisma.DbNull, responsePayload: Prisma.DbNull },
  });
}

export async function startAiGenerationWorker(input: { baseUrl: string }) {
  if (workerTimer) return;
  await recoverInterruptedJobs();
  workerTimer = setInterval(() => {
    void claimNextJob(input.baseUrl).catch((error) => console.error("Error en cola persistente de IA:", error));
  }, 900);
  workerTimer.unref();
  recoveryTimer = setInterval(() => {
    void recoverInterruptedJobs().catch((error) => console.error("Error al recuperar trabajos IA interrumpidos:", error));
  }, 15_000);
  recoveryTimer.unref();
  cleanupTimer = setInterval(() => {
    void cleanupOldJobs().catch((error) => console.error("Error al limpiar trabajos IA antiguos:", error));
  }, 6 * 60 * 60 * 1000);
  cleanupTimer.unref();
  console.log("Cola persistente de IA activa.");
}

export async function saveAiGenerationLimit(input: { value: number; updatedById: string }) {
  const value = normalizeAiGenerationLimit(input.value);
  if (value !== input.value) {
    throw errorWithStatus("El máximo de generaciones debe ser un entero entre 0 y 100. Use 0 para no establecer límite.", 400);
  }
  const setting = await database.institutionalSetting.upsert({
    where: { key: AI_GENERATION_LIMIT_SETTING_KEY },
    update: { value: String(value), updatedById: input.updatedById },
    create: { key: AI_GENERATION_LIMIT_SETTING_KEY, value: String(value), updatedById: input.updatedById },
  });
  await database.auditLog.create({
    data: {
      userId: input.updatedById,
      action: "AI_GENERATION_LIMIT_UPDATED",
      entityType: "InstitutionalSetting",
      entityId: AI_GENERATION_LIMIT_SETTING_KEY,
      details: { maxGenerationsPerContent: value, unlimited: value === 0 },
    },
  });
  return setting;
}
