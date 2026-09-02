import assert from "node:assert/strict";
import test from "node:test";
import {
  unexpectedUserFacingError,
  userFacingServiceError,
} from "../src/http/user-facing-error.js";

test("los creditos agotados del proveedor se traducen a un mensaje institucional claro", () => {
  const result = userFacingServiceError(
    new Error("You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/"),
  );
  assert.equal(result?.statusCode, 402);
  assert.equal(result?.code, "AI_PROVIDER_CREDITS_EXHAUSTED");
  assert.match(result?.error || "", /créditos disponibles/i);
  assert.equal(result?.retryable, false);
  assert.doesNotMatch(result?.error || "", /platform\.openai\.com/i);
});

test("una credencial invalida se presenta como configuracion institucional", () => {
  const error = Object.assign(new Error("Incorrect API key provided"), { status: 401 });
  const result = userFacingServiceError(error);
  assert.equal(result?.statusCode, 424);
  assert.equal(result?.code, "AI_PROVIDER_CONFIGURATION_ERROR");
  assert.equal(result?.retryable, false);
});

test("el limite temporal del proveedor conserva semantica reintentable", () => {
  const error = Object.assign(new Error("Rate limit reached"), { status: 429 });
  const result = userFacingServiceError(error);
  assert.equal(result?.statusCode, 429);
  assert.equal(result?.code, "AI_PROVIDER_RATE_LIMIT");
  assert.equal(result?.retryable, true);
});

test("un error inesperado nunca expone el literal Error interno del servidor", () => {
  const result = unexpectedUserFacingError();
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(result.error, /Error interno del servidor/i);
  assert.match(result.guidance, /Administración/i);
});
