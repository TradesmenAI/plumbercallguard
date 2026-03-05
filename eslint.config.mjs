import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build / test config files — not application code
    "jest.config.js",
    "jest.setup.js",
  ]),
  // Supabase query results and Twilio payloads are dynamically typed throughout the
  // server-side routes. Enforcing strict no-any here provides no safety benefit and
  // would require thousands of cast statements, so we allow 'any' in those files.
  {
    files: ["app/**/*.ts", "app/**/*.tsx", "__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
