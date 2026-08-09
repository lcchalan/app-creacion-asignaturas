import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPasswordChange,
  assertTemporaryPasswordTarget,
  MINIMUM_PASSWORD_LENGTH,
  otherSessionsWhere,
  passwordHash,
  passwordMatches,
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
    newPassword: "Contraseña nueva 2026",
    confirmPassword: "Contraseña nueva 2026",
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
