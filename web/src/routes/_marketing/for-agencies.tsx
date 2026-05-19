import { createFileRoute } from "@tanstack/react-router";
import { buildPageSeo } from "@/lib/seo";

const title = "AgencyFlow SEO — White-label dashboards for agencies";
const description =
  "Run your agency on a branded SEO platform. Client portals, automated weekly PDF reports, rank tracking, and pay-as-you-grow DataForSEO usage.";

export const Route = createFileRoute("/_marketing/for-agencies")({
  head: () =>
    buildPageSeo({
      title,
      description,
      path: "/for-agencies",
      titleSuffix: "AgencyFlow SEO",
    }),
  component: ForAgenciesPage,
});

const tiers = [
  {
    name: "Freelancer",
    price: "$49",
    clients: "5 clients",
    features: "Basic white-label, weekly reports",
    margin: "20% DataForSEO markup",
  },
  {
    name: "Agency Starter",
    price: "$149",
    clients: "25 clients",
    features: "Full branding, AI co-pilot, weekly PDFs",
    margin: "25% platform fee",
    highlighted: true,
  },
  {
    name: "Agency Pro",
    price: "$399",
    clients: "Unlimited clients",
    features: "Team seats, priority support, workflows",
    margin: "30% platform fee",
  },
];

function ForAgenciesPage() {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Built for agencies
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight leading-tight">
        White-label SEO dashboards your clients will love
      </h1>
      <p className="mt-4 text-neutral-700 leading-relaxed">
        Stop paying $200+/mo per client for bloated tools. Run your entire agency
        on a beautiful, fully branded SEO platform — powered by open-source
        OpenSEO and your margin on API costs.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href="https://app.openseo.so/sign-up"
          className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Start 14-day free trial
        </a>
        <p className="text-xs text-neutral-500">No card required</p>
      </div>

      <p className="mt-8 text-xs text-neutral-500 border-t border-neutral-200 pt-6">
        Used by 50+ agencies · Forked from 1.6k★ OpenSEO
      </p>

      <section className="mt-10 space-y-6">
        {[
          {
            title: "Built for agencies",
            body: "White-label client portals, automated weekly reports, and team seats — your brand, not ours.",
          },
          {
            title: "Pay-as-you-grow",
            body: "Only pay DataForSEO usage plus a transparent platform fee (20–30%). Keep 60–75% margins.",
          },
          {
            title: "AI that actually helps",
            body: "Auto content briefs, gap analysis, and next-action recommendations via MCP agents.",
          },
          {
            title: "Proven stack",
            body: "Rank tracking, backlinks, site audits, and keyword research — production-ready on Cloudflare.",
          },
        ].map((item) => (
          <div key={item.title}>
            <h2 className="text-lg font-semibold text-neutral-900">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 leading-relaxed">
              {item.body}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Pricing</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Billed annually. Add-on: white-label domain setup + training ($499
          one-time).
        </p>
        <div className="mt-6 space-y-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-lg border px-5 py-4 ${
                tier.highlighted
                  ? "border-emerald-300 bg-emerald-50/60"
                  : "border-neutral-200"
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-semibold">{tier.name}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {tier.price}
                  <span className="text-sm font-normal text-neutral-500">
                    /mo
                  </span>
                </p>
              </div>
              <p className="mt-1 text-sm text-neutral-600">{tier.clients}</p>
              <p className="mt-2 text-sm text-neutral-700">{tier.features}</p>
              <p className="mt-1 text-xs text-emerald-800">{tier.margin}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-5">
        <h2 className="text-lg font-semibold">Why agencies switch</h2>
        <ul className="mt-3 space-y-2 text-sm text-neutral-700">
          <li>
            <strong className="font-medium text-neutral-900">SE Ranking</strong>{" "}
            — strong, but $145–257/mo agency packs with less flexibility.
          </li>
          <li>
            <strong className="font-medium text-neutral-900">
              AgencyAnalytics
            </strong>{" "}
            — great reporting, weaker native SEO depth ($79–239/mo).
          </li>
          <li>
            <strong className="font-medium text-neutral-900">
              Semrush / Ahrefs
            </strong>{" "}
            — powerful, $200–500+/mo, limited true white-label portals.
          </li>
        </ul>
        <p className="mt-4 text-sm text-neutral-600">
          Your edge: lower entry price, open-source transparency, MCP-powered AI,
          and margins you control.
        </p>
      </section>

      <div className="mt-12 rounded-lg bg-neutral-900 px-6 py-8 text-white">
        <h2 className="text-xl font-semibold">
          Ready to look like the biggest agency in town?
        </h2>
        <p className="mt-2 text-sm text-neutral-300">
          Launch in weeks, not months. Self-host or use our managed stack.
        </p>
        <a
          href="https://app.openseo.so/sign-up"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
        >
          Get started free
        </a>
      </div>
    </>
  );
}
