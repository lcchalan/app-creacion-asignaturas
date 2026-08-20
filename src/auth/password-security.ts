import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const MINIMUM_PASSWORD_LENGTH = 12;
export const PASSWORD_RESET_TTL_MINUTES = 30;

function publicAuthError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}


export function assertPasswordComplexity(password: string) {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    throw publicAuthError(`La contraseña debe tener al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`);
  }
  if (!/\p{Lu}/u.test(password)) throw publicAuthError("La contraseña debe incluir al menos una letra mayúscula.");
  if (!/\p{Ll}/u.test(password)) throw publicAuthError("La contraseña debe incluir al menos una letra minúscula.");
  if (!/\p{N}/u.test(password)) throw publicAuthError("La contraseña debe incluir al menos un número.");
  if (!/[^\p{L}\p{N}\s]/u.test(password)) throw publicAuthError("La contraseña debe incluir al menos un carácter especial.");
}

export function generateStrongTemporaryPassword() {
  return `${randomBytes(12).toString("base64url")}Aa1!`;
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
  if (passwordMatches(input.newPassword, storedHash)) {
    throw publicAuthError("La nueva contraseña debe ser diferente de la contraseña actual.");
  }
  assertPasswordComplexity(input.newPassword);
  if (input.newPassword !== input.confirmPassword) {
    throw publicAuthError("La confirmación no coincide con la nueva contraseña.");
  }
}

export function passwordResetTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function assertPasswordResetChange(
  input: { newPassword: string; confirmPassword: string },
  storedHash: string | null,
) {
  if (passwordMatches(input.newPassword, storedHash)) {
    throw publicAuthError("La nueva contraseña debe ser diferente de la contraseña actual.");
  }
  assertPasswordComplexity(input.newPassword);
  if (input.newPassword !== input.confirmPassword) {
    throw publicAuthError("La confirmación no coincide con la nueva contraseña.");
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
