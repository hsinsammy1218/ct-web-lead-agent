import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname, "../..");
for (const name of [".env", ".env.local"]) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] != null) continue;
    process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@ct/core", "@ct/db"],
  // Keep AI SDK out of webpack graph for pages that only import CRUD actions.
  serverExternalPackages: ["playwright", "ai", "@ai-sdk/openai", "@ai-sdk/provider-utils"],
  // Monorepo: include shared config JSON/YAML in serverless traces.
  outputFileTracingRoot: root,
  outputFileTracingIncludes: {
    "/*": [
      "../../config/ct/**/*",
      "../../config/industries.yaml",
      "../../config/denylist.json",
    ],
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      {
        module: /@ai-sdk\/provider-utils/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];
    return config;
  },
};

export default nextConfig;
