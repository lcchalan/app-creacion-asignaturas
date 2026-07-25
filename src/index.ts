import { createServer, type IncomingMessage } from "node:http";
import { URL } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const serverName =
  process.env.MCP_SERVER_NAME ?? "app-creacion-asignaturas";
const serverVersion =
  process.env.MCP_SERVER_VERSION ?? "1.0.0";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: serverName,
    version: serverVersion,
  });

  server.registerTool(
    "hello_world",
    {
      title: "Saludar",
      description:
        "Comprueba que el servidor MCP funciona y devuelve un mensaje de bienvenida.",
      inputSchema: {
        name: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Nombre opcional de la persona que recibirá el saludo."),
      },
      outputSchema: {
        message: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name }) => {
      const message = name
        ? `¡Hola, ${name}! El servidor MCP funciona correctamente.`
        : "¡Hola! El servidor MCP funciona correctamente.";

      return {
        structuredContent: { message },
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    },
  );

  return server;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  const maximumSize = 1_000_000;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > maximumSize) {
      throw new Error("El cuerpo de la solicitud supera el límite permitido.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const httpServer = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
      });

      response.end(
        JSON.stringify({
          status: "ok",
          server: serverName,
          version: serverVersion,
        }),
      );

      return;
    }

    const supportedMethods = new Set(["POST", "GET", "DELETE"]);

    if (
      requestUrl.pathname === "/mcp" &&
      supportedMethods.has(request.method ?? "")
    ) {
      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      response.on("close", () => {
        void transport.close();
        void mcpServer.close();
      });

      await mcpServer.connect(transport);

      const body =
        request.method === "POST"
          ? await readJsonBody(request)
          : undefined;

      await transport.handleRequest(request, response, body);
      return;
    }

    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(
      JSON.stringify({
        error: "Ruta no encontrada",
      }),
    );
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);

    if (!response.headersSent) {
      response.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
      });
    }

    response.end(
      JSON.stringify({
        error: "Error interno del servidor",
      }),
    );
  }
});

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
  console.log(`Verificación: http://localhost:${port}/health`);
  console.log(`MCP: http://localhost:${port}/mcp`);
});
