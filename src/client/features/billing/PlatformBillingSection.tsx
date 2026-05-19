import { useMutation, useQuery } from "@tanstack/react-query";
import type { TenantPlan } from "@/db/tenant.schema";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  createPlatformCheckout,
  getPlatformBillingStatus,
  openPlatformBillingPortal,
} from "@/serverFunctions/tenant-billing";

const UPGRADE_PLANS: TenantPlan[] = [
  "freelancer",
  "agency_starter",
  "agency_pro",
];

export function PlatformBillingSection() {
  const statusQuery = useQuery({
    queryKey: ["platformBillingStatus"],
    queryFn: () => getPlatformBillingStatus(),
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: TenantPlan) =>
      createPlatformCheckout({ data: { plan } }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => openPlatformBillingPortal(),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
  });

  if (statusQuery.isPending) {
    return (
      <div className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-sm text-base-content/60">Loading platform plan…</p>
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return null;
  }

  const status = statusQuery.data;

  if (!status.stripeEnabled || status.isDefaultTenant) {
    return null;
  }

  const pending =
    checkoutMutation.isPending || portalMutation.isPending;
  const error =
    checkoutMutation.error ?? portalMutation.error ?? null;

  return (
    <section
      id="platform"
      className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-base-content">
          Agency platform plan
        </h2>
        <p className="mt-1 text-sm text-base-content/60">
          White-label access for your agency workspace. Usage credits below are
          billed separately per client org.
        </p>
      </div>

      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold">{status.planLabel}</span>
        <span className="text-sm text-base-content/50">
          {status.priceLabel}
        </span>
        {status.subscriptionStatus ? (
          <span className="badge badge-sm badge-ghost capitalize">
            {status.subscriptionStatus}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-base-content/70">
        Client projects: {status.projectCount}
        {status.maxProjects != null ? ` / ${status.maxProjects}` : " (unlimited)"}
      </p>

      {!status.platformActive ? (
        <p className="text-sm text-warning">
          Subscribe to a platform plan to use rank tracking, reports, and API
          features on this branded workspace.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status.platformActive ? (
          <button
            type="button"
            className="btn btn-sm btn-outline"
            disabled={pending}
            onClick={() => portalMutation.mutate()}
          >
            Manage subscription
          </button>
        ) : (
          UPGRADE_PLANS.map((plan) => (
            <button
              key={plan}
              type="button"
              className={`btn btn-sm ${
                plan === status.plan ? "btn-primary" : "btn-outline"
              }`}
              disabled={pending}
              onClick={() => checkoutMutation.mutate(plan)}
            >
              {plan === "freelancer"
                ? "Freelancer"
                : plan === "agency_starter"
                  ? "Starter"
                  : "Pro"}
            </button>
          ))
        )}
      </div>

      {error ? (
        <p className="text-sm text-error">
          {getStandardErrorMessage(error, "Billing action failed")}
        </p>
      ) : null}
    </section>
  );
}
