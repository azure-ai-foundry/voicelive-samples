import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "voice-live-trader";
const isGhPages = process.env.GITHUB_ACTIONS === "true" && process.env.NODE_ENV === "production";
// For GitHub Pages (project pages): https://<owner>.github.io/<repoName>/
const basePath = isGhPages ? `/${repoName}` : "";
// const basePath = "";

const nextConfig: NextConfig = {
  ...(isGhPages ? { output: "export", trailingSlash: true } : {}),
  basePath,
  assetPrefix: basePath,
  images: {
    ...(isGhPages ? { unoptimized: true } : {}),
    remotePatterns: [
      {
        protocol: "https",
        hostname: "devblogs.microsoft.com",
        pathname: "/foundry/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
