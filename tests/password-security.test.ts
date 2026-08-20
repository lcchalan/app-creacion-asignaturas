import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPasswordChange,
  assertPasswordComplexity,
  assertPasswordResetChange,
  assertTemporaryPasswordTarget,
  generateStrongTemporaryPassword,
  MINIMUM_PASSWORD_LENGTH,
  otherSessionsWhere,
  passwordHash,
  passwordMatches,
  passwordResetTokenHash,
  passwordResetTokenIsUsable,
} from "../src/auth/password-security.js";

test("genera hashes con sal y valida únicamente la contraseña correcta", () => {
  const first = passwordHash("Clave segura 2026");
  const second = passwordHash("Clave segura 2026");

  assert.notEqual(first, second);
  assert.equal(passwordMatches("Clave segura 2026", first), true);
  assert.equal(passwordMatches("otra clave", first), false);
  assert.equal(passwordMatches("Clave segura 2026", "hash-invalido"), false);
});

test("impide asignar una contraseña temporal a la cuenta propia", () => {
  assert.throws(
    () => assertTemporaryPasswordTarget("admin-1", "admin-1"),
    /No puede asignarse una contraseña temporal/,
  );
  assert.doesNotThrow(() => assertTemporaryPasswordTarget("admin-1", "user-2"));
});

test("exige contraseña actual, confirmación y una contraseña nueva distinta", () => {
  const stored = passwordHash("Contraseña anterior");
  const valid = {
    currentPassword: "Contraseña anterior",
    newPassword: "Contraseña nueva 2026!",
    confirmPassword: "Contraseña nueva 2026!",
  };

  assert.doesNotThrow(() => assertPasswordChange(valid, stored));
  assert.throws(() => assertPasswordChange({ ...valid, currentPassword: "incorrecta" }, stored), /actual es incorrecta/);
  assert.throws(() => assertPasswordChange({ ...valid, confirmPassword: "no coincide" }, stored), /confirmación no coincide/);
  assert.throws(() => assertPasswordChange({
    ...valid,
    newPassword: "Contraseña anterior",
    confirmPassword: "Contraseña anterior",
  }, stored), /debe ser diferente/);
  assert.throws(() => assertPasswordChange({
    ...valid,
    newPassword: "corta",
    confirmPassword: "corta",
  }, stored), new RegExp(`${MINIMUM_PASSWORD_LENGTH} caracteres`));
});

test("conserva la sesión actual al construir el filtro de revocación", () => {
  assert.deepEqual(otherSessionsWhere("user-1", "token-actual"), {
    userId: "user-1",
    tokenHash: { not: "token-actual" },
  });
});


test("genera un hash estable para el token de restablecimiento sin guardar el token original", () => {
  const token = "token-de-restablecimiento-seguro-123456";
  const hashed = passwordResetTokenHash(token);
  assert.equal(hashed.length, 64);
  assert.equal(hashed, passwordResetTokenHash(token));
  assert.notEqual(hashed, token);
});

test("acepta únicamente enlaces de restablecimiento vigentes y no utilizados", () => {
  const now = new Date("2026-08-14T20:00:00.000Z");
  assert.equal(passwordResetTokenIsUsable({ expiresAt: new Date("2026-08-14T20:30:00.000Z"), usedAt: null }, now), true);
  assert.equal(passwordResetTokenIsUsable({ expiresAt: new Date("2026-08-14T19:59:59.000Z"), usedAt: null }, now), false);
  assert.equal(passwordResetTokenIsUsable({ expiresAt: new Date("2026-08-14T20:30:00.000Z"), usedAt: now }, now), false);
});

test("el restablecimiento exige una contraseña nueva válida y confirmada", () => {
  const stored = passwordHash("Contraseña anterior");
  assert.doesNotThrow(() => assertPasswordResetChange({
    newPassword: "Nueva contraseña segura 2026!",
    confirmPassword: "Nueva contraseña segura 2026!",
  }, stored));
  assert.throws(() => assertPasswordResetChange({
    newPassword: "Nueva contraseña segura 2026!",
    confirmPassword: "otra contraseña",
  }, stored), /confirmación no coincide/);
  assert.throws(() => assertPasswordResetChange({
    newPassword: "Contraseña anterior",
    confirmPassword: "Contraseña anterior",
  }, stored), /debe ser diferente/);
});


test("exige mayúscula, minúscula, número y carácter especial", () => {
  assert.doesNotThrow(() => assertPasswordComplexity("Clave segura 2026!"));
  assert.throws(() => assertPasswordComplexity("clave segura 2026!"), /mayúscula/);
  assert.throws(() => assertPasswordComplexity("CLAVE SEGURA 2026!"), /minúscula/);
  assert.throws(() => assertPasswordComplexity("Clave segura especial!"), /número/);
  assert.throws(() => assertPasswordComplexity("Clave segura 2026"), /carácter especial/);
});

test("genera contraseñas temporales que cumplen la política completa", () => {
  for (let index = 0; index < 20; index += 1) {
    assert.doesNotThrow(() => assertPasswordComplexity(generateStrongTemporaryPassword()));
  }
});
