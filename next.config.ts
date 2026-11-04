import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["firebase-admin"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/firebase-admin/**/*",
      "./node_modules/@google-cloud/firestore/**/*",
      "./node_modules/@google-cloud/firestore-api/**/*",
      "./node_modules/@grpc/grpc-js/**/*",
      "./node_modules/google-auth-library/**/*",
      "./node_modules/google-gax/**/*",
      "./node_modules/gaxios/**/*",
      "./node_modules/gcp-metadata/**/*",
      "./node_modules/jsonwebtoken/**/*",
      "./node_modules/jwks-rsa/**/*",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
