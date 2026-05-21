import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { devtools } from "@tanstack/devtools-vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = env.PORT ? Number(env.PORT) : 3001;
  const showDevtools = env.VITE_SHOW_DEVTOOLS !== "false";
  const emitSourcemaps = env.POSTHOG_SOURCEMAPS === "true";

  // PaaS health checks reach the app via internal hostnames that differ from
  // the public domain (e.g. Railway uses `healthcheck.railway.app`). These
  // must always be allowed or every deploy is rejected as unhealthy.
  const PLATFORM_HEALTHCHECK_HOSTS = [
    "healthcheck.railway.app",
    "localhost",
    "127.0.0.1",
  ];

  // `ALLOWED_HOST` accepts a comma-separated list. Setting it to `*` allows
  // any host — useful when the app is fronted by a trusted proxy that strips
  // arbitrary Host headers. Otherwise stick to explicit hostnames.
  const rawAllowedHosts = (env.ALLOWED_HOST ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);
  const wildcardAll = rawAllowedHosts.includes("*");

  const allowedHosts = wildcardAll
    ? (true as const)
    : [
        ...PLATFORM_HEALTHCHECK_HOSTS,
        ...rawAllowedHosts,
        env.BETTER_AUTH_URL
          ? new URL(env.BETTER_AUTH_URL).hostname
          : undefined,
      ].filter((host): host is string => Boolean(host));

  return {
    envPrefix: ["VITE_", "AUTH_MODE", "POSTHOG_PUBLIC_KEY", "POSTHOG_HOST"],
    server: {
      allowedHosts,
      port,
    },
    preview: {
      allowedHosts,
      port,
    },
    build: {
      sourcemap: emitSourcemaps,
      outDir: emitSourcemaps ? "dist-sourcemaps" : "dist",
    },
    plugins: [
      showDevtools
        ? devtools({
            consolePiping: {
              enabled: true,
              levels: ["log", "warn", "error", "info", "debug"],
            },
          })
        : null,
      cloudflare({ viteEnvironment: { name: "ssr" } }),
      tsConfigPaths(),
      tanstackStart(),
      viteReact(),
      tailwindcss(),
    ],
  };
});
