import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getAuth, getHostedAuthConfigError } from "@/lib/auth";
import { isHostedAuthMode } from "@/lib/auth-mode";

async function handleAuthRequest(request: Request) {
  if (!isHostedAuthMode(env.AUTH_MODE)) {
    return new Response("Not found", {
      status: 404,
    });
  }

  const configError = getHostedAuthConfigError();
  if (configError) {
    console.error("[auth] hosted auth config invalid:", configError);
    return new Response(`Hosted auth config: ${configError}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  try {
    const auth = getAuth();
    return await auth.handler(request);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error("[auth] handler threw:", message);
    return new Response(`Better Auth handler error: ${message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return handleAuthRequest(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return handleAuthRequest(request);
      },
    },
  },
});
