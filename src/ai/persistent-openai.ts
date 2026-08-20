import { createHash } from "node:crypto";
import type OpenAI from "openai";
import { database } from "../db/client.js";
import {
  currentAiJobId,
  heartbeatAiJob,
  nextAiRemoteCallKey,
} from "./persistent-ai-jobs.js";

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value, (_key, item) => typeof item === "function" ? undefined : item)).digest("hex");
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function responseError(response: any) {
  const message = response?.error?.message || response?.incomplete_details?.reason || `OpenAI terminó la respuesta con estado ${response?.status || "desconocido"}.`;
  return new Error(String(message));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backgroundResponseParams(params: any) {
  const format = params?.text?.format;
  if (!format || typeof format !== "object") return { ...params, background: true };
  const apiFormat = Object.fromEntries(
    Object.entries(format).filter(([key, value]) => !key.startsWith("$") && typeof value !== "function"),
  );
  return {
    ...params,
    background: true,
    text: { ...params.text, format: apiFormat },
  };
}

function providerStatus(error: unknown) {
  const value = error as { status?: number; statusCode?: number };
  return Number(value?.status || value?.statusCode || 0);
}

async function ensureRemoteCall(input: {
  jobId: string;
  stepKey: string;
  kind: string;
  requestHash: string;
}) {
  const existing = await database.aiGenerationRemoteCall.findUnique({
    where: { jobId_stepKey: { jobId: input.jobId, stepKey: input.stepKey } },
  });
  if (existing && existing.requestHash !== input.requestHash) {
    throw new Error(`El trabajo IA ${input.jobId} cambió su solicitud interna en ${input.stepKey}; se detuvo para evitar una generación duplicada.`);
  }
  if (existing) return existing;
  return database.aiGenerationRemoteCall.create({
    data: {
      jobId: input.jobId,
      stepKey: input.stepKey,
      kind: input.kind,
      requestHash: input.requestHash,
      status: "PENDING",
    },
  });
}

async function persistentResponsesCreate(
  client: OpenAI,
  originalCreate: (...args: any[]) => Promise<any>,
  originalRetrieve: (...args: any[]) => Promise<any>,
  params: any,
  options?: any,
) {
  const jobId = currentAiJobId();
  const stepKey = nextAiRemoteCallKey("RESPONSES");
  if (!jobId || !stepKey) return originalCreate(params, options);

  const requestHash = stableHash(params);
  let remote = await ensureRemoteCall({ jobId, stepKey, kind: "RESPONSES", requestHash });
  if (remote.status === "COMPLETED" && remote.responsePayload) {
    return { ...(remote.responsePayload as Record<string, unknown>), output_text: remote.outputText || (remote.responsePayload as any).output_text || "" } as any;
  }

  let response: any;
  if (remote.providerResponseId && !["FAILED", "CANCELLED", "INCOMPLETE"].includes(remote.status)) {
    try {
      response = await originalRetrieve(remote.providerResponseId);
    } catch (error) {
      if (providerStatus(error) !== 404) throw error;
      remote = await database.aiGenerationRemoteCall.update({
        where: { id: remote.id },
        data: {
          providerResponseId: null,
          status: "PENDING",
          errorMessage: "La respuesta remota ya no estaba disponible; se reiniciara tecnicamente dentro del mismo trabajo persistente.",
        },
      });
    }
  }
  if (!response) {
    response = await originalCreate(backgroundResponseParams(params), options);
    remote = await database.aiGenerationRemoteCall.update({
      where: { id: remote.id },
      data: {
        providerResponseId: response.id || null,
        status: String(response.status || "SUBMITTED").toUpperCase(),
        attemptCount: { increment: 1 },
        errorMessage: null,
      },
    });
  }

  const startedAt = Date.now();
  while (true) {
    const status = String(response?.status || "").toLowerCase();
    await heartbeatAiJob(jobId);
    if (status === "completed") {
      const stored = jsonClone(response);
      await database.aiGenerationRemoteCall.update({
        where: { id: remote.id },
        data: {
          status: "COMPLETED",
          responsePayload: stored as never,
          outputText: String(response.output_text || ""),
          errorMessage: null,
          completedAt: new Date(),
          providerResponseId: response.id || remote.providerResponseId,
        },
      });
      return response;
    }
    if (["failed", "cancelled", "incomplete"].includes(status)) {
      const error = responseError(response);
      await database.aiGenerationRemoteCall.update({
        where: { id: remote.id },
        data: {
          status: status.toUpperCase(),
          responsePayload: jsonClone(response) as never,
          errorMessage: error.message.slice(0, 10_000),
          completedAt: new Date(),
        },
      });
      throw error;
    }
    if (!response?.id) {
      throw new Error("OpenAI no devolvió un identificador recuperable para la generación en segundo plano.");
    }
    if (Date.now() - startedAt > 12 * 60 * 1000) {
      throw new Error("La generación de OpenAI continúa sin finalizar después de 12 minutos; el trabajo persistente la retomará automáticamente.");
    }
    await database.aiGenerationRemoteCall.update({
      where: { id: remote.id },
      data: {
        status: String(response.status || "RUNNING").toUpperCase(),
        providerResponseId: response.id,
      },
    });
    await sleep(1_750);
    response = await originalRetrieve(response.id);
  }
}

function parseStructuredOutput(params: any, outputText: string) {
  const parser = params?.text?.format?.$parseRaw;
  if (typeof parser === "function") return parser(outputText);
  const cleaned = String(outputText || "").trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function persistentResponsesParse(
  client: OpenAI,
  originalCreate: (...args: any[]) => Promise<any>,
  originalParse: (...args: any[]) => Promise<any>,
  originalRetrieve: (...args: any[]) => Promise<any>,
  params: any,
  options?: any,
) {
  const jobId = currentAiJobId();
  if (!jobId) return originalParse(params, options);
  const response = await persistentResponsesCreate(client, originalCreate, originalRetrieve, params, options);
  return Object.assign(response, { output_parsed: parseStructuredOutput(params, response.output_text) });
}

async function persistentImagesGenerate(
  originalGenerate: (...args: any[]) => Promise<any>,
  params: any,
  options?: any,
) {
  const jobId = currentAiJobId();
  const stepKey = nextAiRemoteCallKey("IMAGES");
  if (!jobId || !stepKey) return originalGenerate(params, options);
  const requestHash = stableHash(params);
  const remote = await ensureRemoteCall({ jobId, stepKey, kind: "IMAGES", requestHash });
  if (remote.status === "COMPLETED" && remote.responsePayload) {
    return remote.responsePayload as any;
  }
  await database.aiGenerationRemoteCall.update({
    where: { id: remote.id },
    data: { status: "RUNNING", attemptCount: { increment: 1 }, errorMessage: null },
  });
  await heartbeatAiJob(jobId);
  try {
    const result = await originalGenerate(params, options);
    const stored = jsonClone(result);
    await database.aiGenerationRemoteCall.update({
      where: { id: remote.id },
      data: { status: "COMPLETED", responsePayload: stored as never, completedAt: new Date() },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await database.aiGenerationRemoteCall.update({
      where: { id: remote.id },
      data: { status: "FAILED", errorMessage: message.slice(0, 10_000), completedAt: new Date() },
    });
    throw error;
  }
}

export function wrapPersistentOpenAI<T extends OpenAI>(client: T): T {
  const responses = client.responses as any;
  const images = client.images as any;
  const originalCreate = responses.create.bind(responses);
  const originalParse = responses.parse.bind(responses);
  const originalRetrieve = responses.retrieve.bind(responses);
  const originalImageGenerate = images.generate.bind(images);

  responses.create = (params: any, options?: any) =>
    persistentResponsesCreate(client, originalCreate, originalRetrieve, params, options);
  responses.parse = (params: any, options?: any) =>
    persistentResponsesParse(client, originalCreate, originalParse, originalRetrieve, params, options);
  images.generate = (params: any, options?: any) =>
    persistentImagesGenerate(originalImageGenerate, params, options);

  return client;
}
