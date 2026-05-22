import { getAuth, getHostedAuthConfigError } from "@/lib/auth";
import { getActiveOrganizationId } from "@/lib/auth-session";
import { getOrCreateDefaultHostedOrganization } from "@/server/auth/default-hosted-organization";
import { AppError } from "@/server/lib/errors";
import type { ResolvedAuthContext } from "./types";

async function requireHostedSession(headers: Headers) {
  const configError = getHostedAuthConfigError();
  if (configError) {
    console.error("[auth] hosted auth config invalid:", configError);
    throw new AppError(
      "AUTH_CONFIG_MISSING",
      `Missing Better Auth hosted configuration: ${configError}`,
    );
  }

  const session = await getAuth().api.getSession({ headers });

  if (!session?.user?.id || !session.user.email) {
    throw new AppError("UNAUTHENTICATED");
  }

  return session;
}

export async function resolveHostedContext(
  headers: Headers,
): Promise<ResolvedAuthContext> {
  const session = await requireHostedSession(headers);
  const activeOrganizationId = getActiveOrganizationId(session);

  if (activeOrganizationId) {
    return {
      userId: session.user.id,
      userEmail: session.user.email,
      organizationId: activeOrganizationId,
    };
  }

  const authApi = getAuth().api;
  const organizationId = await getOrCreateDefaultHostedOrganization(
    session.user.id,
    (body) => authApi.createOrganization({ body }),
  );

  await authApi.setActiveOrganization({
    headers,
    body: { organizationId },
  });

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    organizationId,
  };
}
