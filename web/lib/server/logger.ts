export interface ApiErrorContext {
  route: string;
  method: string;
  status: number;
  action: string;
  error: unknown;
  context?: Record<string, unknown>;
}

export function logApiError({
  route,
  method,
  status,
  action,
  error,
  context,
}: ApiErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      route,
      method,
      status,
      action,
      message,
      stack,
      context: context ?? null,
      timestamp: new Date().toISOString(),
    }),
  );
}
