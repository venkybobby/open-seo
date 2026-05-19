import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getWeeklyReportSettings = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const subscription = await ReportRepository.getSubscription(
      context.organizationId,
    );

    return {
      enabled: subscription?.enabled ?? true,
      lastSentAt: subscription?.lastSentAt ?? null,
    };
  });

export const setWeeklyReportEnabled = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ enabled: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await ReportRepository.setSubscriptionEnabled(
      context.organizationId,
      data.enabled,
    );

    return { enabled: data.enabled };
  });
