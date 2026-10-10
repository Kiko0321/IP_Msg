import type { Instrumentation } from "next";
import { logger } from "@/lib/logger";

export function register() {
  logger.info("server started", { runtime: process.env.NEXT_RUNTIME ?? "nodejs" });
}

// Every server-side error (Server Components, Route Handlers, Server Actions, proxy) lands here.
// The digest matches the "Error ID" users see on the error page, so a report can be traced to this log.
// Only the method and path are logged: no headers, cookies, query strings or bodies.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;

  logger.error("request failed", {
    digest,
    error,
    method: request.method,
    path: request.path.split("?")[0],
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
