import {
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { organization } from "./better-auth-schema";

export const tenantPlans = [
  "freelancer",
  "agency_starter",
  "agency_pro",
  "enterprise",
] as const;

export type TenantPlan = (typeof tenantPlans)[number];

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    agencyName: text("agency_name").notNull(),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    customDomain: text("custom_domain"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionStatus: text("subscription_status"),
    plan: text("plan", {
      enum: tenantPlans,
    })
      .notNull()
      .default("freelancer"),
    dataforseoKeyEncrypted: text("dataforseo_key_encrypted"),
    status: text("status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("tenants_slug_uidx").on(table.slug),
    uniqueIndex("tenants_custom_domain_uidx").on(table.customDomain),
    index("tenants_status_idx").on(table.status),
  ],
);

/** Maps Better Auth organizations to white-label platform tenants. */
export const organizationTenants = sqliteTable(
  "organization_tenants",
  {
    organizationId: text("organization_id")
      .primaryKey()
      .references(() => organization.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("organization_tenants_tenant_idx").on(table.tenantId)],
);
