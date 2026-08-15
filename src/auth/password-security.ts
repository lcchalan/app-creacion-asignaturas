import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MINIMUM_PASSWORD_LENGTH = 12;
export const PASSWORD_RESET_TTL_MINUTES = 30;

function publicAuthError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function passwordMatches(password: string, stored: string | null) {
  if (!stored) return false;
  const [salt, expectedHex, ...unexpected] = stored.split(":");
  if (!salt || !expectedHex || unexpected.length || !/^[0-9a-f]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function assertPasswordChange(
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
  storedHash: string | null,
) {
  if (!passwordMatches(input.currentPassword, storedHash)) {
    throw publicAuthError("La contraseña actual es incorrecta.");
  }
  if (input.newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    throw publicAuthError(`La nueva contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`);
  }
  if (input.newPassword !== input.confirmPassword) {
    throw publicAuthError("La confirmación no coincide con la nueva contraseña.");
  }
  if (passwordMatches(input.newPassword, storedHash)) {
    throw publicAuthError("La nueva contraseña debe ser diferente de la contraseña actual.");
  }
}

export function passwordResetTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function assertPasswordResetChange(
  input: { newPassword: string; confirmPassword: string },
  storedHash: string | null,
) {
  if (input.newPassword.length < MINIMUM_PASSWORD_LENGTH) {
    throw publicAuthError(`La nueva contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`);
  }
  if (input.newPassword !== input.confirmPassword) {
    throw publicAuthError("La confirmación no coincide con la nueva contraseña.");
  }
  if (passwordMatches(input.newPassword, storedHash)) {
    throw publicAuthError("La nueva contraseña debe ser diferente de la contraseña actual.");
  }
}

export function passwordResetTokenIsUsable(
  token: { expiresAt: Date; usedAt: Date | null },
  now = new Date(),
) {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}

export function assertTemporaryPasswordTarget(actorUserId: string, targetUserId: string) {
  if (actorUserId === targetUserId) {
    throw publicAuthError("No puede asignarse una contraseña temporal a su propia cuenta. Use «Cambiar mi contraseña».");
  }
}

export function otherSessionsWhere(userId: string, currentTokenHash: string) {
  return { userId, tokenHash: { not: currentTokenHash } };
}
