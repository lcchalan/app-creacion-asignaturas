import { connect as connectNet, type Socket } from "node:net";
import { connect as connectTls, type TLSSocket } from "node:tls";
import { randomBytes } from "node:crypto";

export type SmtpConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  user: string;
  password: string;
  from: string;
};

type MailSocket = Socket | TLSSocket;

type SmtpResponse = {
  code: number;
  text: string;
};

function envBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function smtpConfigurationFromEnv(): SmtpConfiguration {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD ?? "";
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !from) {
    throw new Error("Configure SMTP_HOST y SMTP_FROM para habilitar el envío de correo institucional.");
  }
  const secure = envBoolean(process.env.SMTP_SECURE, false);
  const defaultPort = secure ? 465 : 587;
  const port = Number.parseInt(process.env.SMTP_PORT ?? String(defaultPort), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT no contiene un puerto válido.");
  }
  if ((user && !password) || (!user && password)) {
    throw new Error("SMTP_USER y SMTP_PASSWORD deben configurarse juntos.");
  }
  const startTls = !secure && envBoolean(process.env.SMTP_STARTTLS, true);
  if (process.env.NODE_ENV === "production" && !secure && !startTls) {
    throw new Error("El envío de correo institucional requiere una conexión SMTP cifrada en producción.");
  }
  return {
    host,
    port,
    secure,
    startTls,
    user,
    password,
    from,
  };
}

function waitForSocket(socket: MailSocket, event: "connect" | "secureConnect") {
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al conectar con el servidor SMTP."));
    };
    const cleanup = () => {
      socket.off(event, onReady);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    socket.once(event, onReady);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

function readSmtpResponse(socket: MailSocket) {
  return new Promise<SmtpResponse>((resolve, reject) => {
    let buffer = "";
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/u).filter(Boolean);
      const last = lines.at(-1) ?? "";
      const match = /^(\d{3})\s/u.exec(last);
      if (!match) return;
      cleanup();
      resolve({ code: Number.parseInt(match[1]!, 10), text: lines.join("\n") });
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onTimeout = () => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al esperar respuesta SMTP."));
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("timeout", onTimeout);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("timeout", onTimeout);
  });
}

async function smtpCommand(socket: MailSocket, command: string, expectedCodes: number[]) {
  const responsePromise = readSmtpResponse(socket);
  socket.write(`${command}\r\n`);
  const response = await responsePromise;
  if (!expectedCodes.includes(response.code)) {
    throw new Error(`SMTP rechazó el comando (${response.code}): ${response.text}`);
  }
  return response;
}

function envelopeAddress(value: string) {
  const bracket = /<([^<>]+)>/u.exec(value)?.[1]?.trim();
  const address = bracket || value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)) {
    throw new Error("SMTP_FROM no contiene una dirección de correo válida.");
  }
  return address;
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/gu, " ").trim();
}

function encodedSubject(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function dotStuff(value: string) {
  return value.replace(/\r?\n/gu, "\r\n").replace(/^\./gmu, "..");
}

async function openSmtpConnection(config: SmtpConfiguration) {
  if (config.secure) {
    const socket = connectTls({ host: config.host, port: config.port, servername: config.host, rejectUnauthorized: true });
    socket.setTimeout(15_000);
    await waitForSocket(socket, "secureConnect");
    return socket as MailSocket;
  }
  const socket = connectNet({ host: config.host, port: config.port });
  socket.setTimeout(15_000);
  await waitForSocket(socket, "connect");
  return socket as MailSocket;
}

async function upgradeStartTls(socket: MailSocket, host: string) {
  await smtpCommand(socket, "STARTTLS", [220]);
  const secureSocket = connectTls({ socket: socket as Socket, servername: host, rejectUnauthorized: true });
  secureSocket.setTimeout(15_000);
  await waitForSocket(secureSocket, "secureConnect");
  return secureSocket as MailSocket;
}

export async function sendPlainTextEmail(input: {
  to: string;
  subject: string;
  body: string;
  configuration?: SmtpConfiguration;
}) {
  const config = input.configuration ?? smtpConfigurationFromEnv();
  let socket = await openSmtpConnection(config);
  try {
    const greeting = await readSmtpResponse(socket);
    if (greeting.code !== 220) throw new Error(`SMTP no aceptó la conexión: ${greeting.text}`);
    await smtpCommand(socket, `EHLO ${safeHeader(process.env.SMTP_HELO_NAME || "gestion-guia.local")}`, [250]);
    if (config.startTls) {
      socket = await upgradeStartTls(socket, config.host);
      await smtpCommand(socket, `EHLO ${safeHeader(process.env.SMTP_HELO_NAME || "gestion-guia.local")}`, [250]);
    }
    if (config.user) {
      await smtpCommand(socket, "AUTH LOGIN", [334]);
      await smtpCommand(socket, Buffer.from(config.user, "utf8").toString("base64"), [334]);
      await smtpCommand(socket, Buffer.from(config.password, "utf8").toString("base64"), [235]);
    }
    const fromAddress = envelopeAddress(config.from);
    const toAddress = envelopeAddress(input.to);
    await smtpCommand(socket, `MAIL FROM:<${fromAddress}>`, [250]);
    await smtpCommand(socket, `RCPT TO:<${toAddress}>`, [250, 251]);
    await smtpCommand(socket, "DATA", [354]);

    const messageId = `<${randomBytes(16).toString("hex")}@${config.host}>`;
    const message = [
      `From: ${safeHeader(config.from)}`,
      `To: ${safeHeader(input.to)}`,
      `Subject: ${encodedSubject(input.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: ${messageId}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      dotStuff(input.body),
      ".",
      "",
    ].join("\r\n");
    const responsePromise = readSmtpResponse(socket);
    socket.write(message);
    const accepted = await responsePromise;
    if (accepted.code !== 250) throw new Error(`SMTP no aceptó el mensaje: ${accepted.text}`);
    await smtpCommand(socket, "QUIT", [221]);
  } finally {
    socket.end();
    socket.destroy();
  }
}

export async function sendPasswordResetEmail(input: {
  to: string;
  displayName: string;
  resetUrl: string;
  expiresMinutes: number;
}) {
  const greeting = input.displayName.trim() ? `Hola ${input.displayName.trim()},` : "Hola,";
  const body = [
    greeting,
    "",
    "Se solicitó restablecer la contraseña de su cuenta en el Sistema de Gestión Guía didáctica.",
    "",
    "Abra el siguiente enlace para crear una nueva contraseña:",
    input.resetUrl,
    "",
    `El enlace puede utilizarse una sola vez y vence en ${input.expiresMinutes} minutos.`,
    "",
    "Si usted no solicitó este cambio, ignore este mensaje. Su contraseña actual seguirá vigente.",
    "",
    "Sistema de Gestión Guía didáctica",
  ].join("\n");
  await sendPlainTextEmail({
    to: input.to,
    subject: "Restablecimiento de contraseña - Sistema de Gestión Guía didáctica",
    body,
  });
}
