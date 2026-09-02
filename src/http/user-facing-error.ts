export type UserFacingServiceError = {
  statusCode: number;
  code: string;
  eyebrow: string;
  title: string;
  error: string;
  guidance: string;
  actionLabel: string;
  retryable: boolean;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

function providerStatus(error: unknown) {
  const value = error as { status?: number; statusCode?: number };
  return Number(value?.status || value?.statusCode || 0);
}

export function userFacingServiceError(error: unknown): UserFacingServiceError | null {
  const message = errorMessage(error);
  const status = providerStatus(error);

  if (
    /no credits remaining|add credits|insufficient[_\s-]*quota|credit balance|billing/i.test(message)
  ) {
    return {
      statusCode: 402,
      code: "AI_PROVIDER_CREDITS_EXHAUSTED",
      eyebrow: "Servicio de IA",
      title: "Generación no disponible",
      error: "La cuenta institucional del servicio de IA no dispone de créditos disponibles.",
      guidance: "Solicite a Administración revisar el saldo o la facturación del servicio de IA y vuelva a intentarlo cuando el servicio esté habilitado.",
      actionLabel: "Entendido",
      retryable: false,
    };
  }

  if (
    /incorrect api key|invalid api key|invalid_api_key|OPENAI_API_KEY no est[aá] configurada|authentication/i.test(message)
    || status === 401
  ) {
    return {
      statusCode: 424,
      code: "AI_PROVIDER_CONFIGURATION_ERROR",
      eyebrow: "Servicio de IA",
      title: "Servicio de IA no disponible",
      error: "No fue posible utilizar el servicio de IA por una configuración institucional pendiente o inválida.",
      guidance: "Solicite a Administración revisar la configuración y las credenciales del servicio de IA.",
      actionLabel: "Entendido",
      retryable: false,
    };
  }

  if (/rate limit|too many requests|requests per min|tokens per min/i.test(message) || status === 429) {
    return {
      statusCode: 429,
      code: "AI_PROVIDER_RATE_LIMIT",
      eyebrow: "Servicio de IA",
      title: "Servicio de IA temporalmente ocupado",
      error: "El proveedor de IA alcanzó temporalmente su límite de solicitudes.",
      guidance: "Espere unos minutos y vuelva a intentarlo. La solicitud no se contabilizará como una generación completada si no finaliza correctamente.",
      actionLabel: "Entendido",
      retryable: true,
    };
  }

  if (/timed out|timeout|despu[eé]s de 12 minutos|contin[uú]a sin finalizar/i.test(message)) {
    return {
      statusCode: 504,
      code: "AI_PROVIDER_TIMEOUT",
      eyebrow: "Servicio de IA",
      title: "La generación está tardando más de lo esperado",
      error: "El servicio de IA no completó la generación dentro del tiempo previsto.",
      guidance: "El sistema intentará recuperar la operación cuando corresponda. Si el mensaje vuelve a aparecer, inténtelo nuevamente más tarde.",
      actionLabel: "Entendido",
      retryable: true,
    };
  }

  if (/ECONNRESET|ECONNREFUSED|fetch failed|network|socket hang up|connection/i.test(message)) {
    return {
      statusCode: 503,
      code: "AI_PROVIDER_CONNECTION_ERROR",
      eyebrow: "Servicio de IA",
      title: "No fue posible conectar con el servicio de IA",
      error: "La conexión con el proveedor de IA se interrumpió temporalmente.",
      guidance: "Espere unos minutos y vuelva a intentarlo. El sistema conserva los trabajos persistentes que ya hayan sido registrados.",
      actionLabel: "Entendido",
      retryable: true,
    };
  }

  return null;
}

export function unexpectedUserFacingError(): UserFacingServiceError {
  return {
    statusCode: 500,
    code: "UNEXPECTED_SERVER_ERROR",
    eyebrow: "No fue posible completar la operación",
    title: "Ocurrió un problema inesperado",
    error: "No fue posible completar la solicitud en este momento.",
    guidance: "Intente nuevamente. Si el inconveniente persiste, comuníquese con Administración e indique qué operación estaba realizando.",
    actionLabel: "Entendido",
    retryable: false,
  };
}
