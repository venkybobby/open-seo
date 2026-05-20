import { createFileRoute } from "@tanstack/react-router";
import type { Stripe as StripeNamespace } from "stripe";
import { isHostedAuthMode } from "@/lib/auth-mode";
import {
  constructStripeWebhookEvent,
  isStripePlatformBillingEnabled,
} from "@/server/billing/stripe";
import {
  handleStripeCheckoutSessionCompleted,
  syncTenantFromStripeSubscription,
} from "@/server/billing/tenant-subscription";
import { env } from "cloudflare:workers";

async function handleStripeEvent(event: StripeNamespace.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      await handleStripeCheckoutSessionCompleted(event.data.object);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncTenantFromStripeSubscription(event.data.object);
      return;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      await syncTenantFromStripeSubscription({
        ...subscription,
        status: "canceled",
      });
      return;
    }
    default:
      return;
  }
}

export const Route = createFileRoute("/api/stripe/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        if (!isHostedAuthMode(env.AUTH_MODE) || !isStripePlatformBillingEnabled()) {
          return new Response("Not found", { status: 404 });
        }

        const signature = request.headers.get("stripe-signature");
        const payload = await request.text();

        try {
          const event = constructStripeWebhookEvent(payload, signature);
          await handleStripeEvent(event);
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("[stripe] Webhook error:", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
