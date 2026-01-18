type CaptureContext = { route?: string; code?: string; requestId?: string; userId?: string | null; extra?: Record<string, unknown> };

export function captureServerError(error: unknown, context?: CaptureContext) {
  try {
    // Avoid bundler resolution when Sentry is not installed
    // eslint-disable-next-line no-eval
    const req = eval("require");
    const sentry = req("@sentry/nextjs");
    sentry.captureException(error, {
      tags: {
        route: context?.route,
        code: context?.code,
        requestId: context?.requestId,
        release: "v0.7.81",
      },
      user: context?.userId ? { id: context.userId } : undefined,
      extra: context?.extra,
    });
  } catch {
    // eslint-disable-next-line no-console
    console.error("[captureServerError]", context?.route ?? "unknown", context?.code ?? "unknown", context?.requestId, error);
  }
}
