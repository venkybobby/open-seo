import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { applyBrandingToDocument } from "@/lib/branding";
import { getTenantBranding } from "@/serverFunctions/tenant";

const TenantBrandingContext = React.createContext<
  Awaited<ReturnType<typeof getTenantBranding>> | null
>(null);

export function useTenantBranding() {
  return React.useContext(TenantBrandingContext);
}

export function TenantBrandingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const brandingQuery = useQuery({
    queryKey: ["tenantBranding"],
    queryFn: () => getTenantBranding(),
    staleTime: 1000 * 60 * 5,
  });

  React.useEffect(() => {
    if (!brandingQuery.data) return;
    applyBrandingToDocument(brandingQuery.data);
  }, [brandingQuery.data]);

  return (
    <TenantBrandingContext.Provider value={brandingQuery.data ?? null}>
      {children}
    </TenantBrandingContext.Provider>
  );
}
