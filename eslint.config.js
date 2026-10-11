import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "data", "drizzle"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Rupiah disajikan via formatRupiah dari lib/transfer-pricing.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'CallExpression[callee.property.name="toLocaleString"][arguments.0.value="id-ID"]',
          message: "Sajikan rupiah via formatRupiah dari lib/transfer-pricing.",
        },
      ],
    },
  },
  // Modul service menerima database: AppDatabase sebagai parameter.
  {
    files: ["src/server/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db"],
              importNames: ["db"],
              message: "Terima database: AppDatabase sebagai parameter, bukan impor db global.",
            },
          ],
        },
      ],
    },
  },
  {
    // Data uji terisolasi: impor db langsung di test sah.
    files: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Pengecualian sah toLocaleString("id-ID"): definisi kanonik rupiah,
    // stempel tanggal email (bukan rupiah), dan data uji terisolasi.
    files: [
      "src/lib/transfer-pricing.ts",
      "src/server/routes/settings.ts",
      "**/*.test.ts",
    ],
    rules: {
      "no-restricted-syntax": "off",
    },
  }
);
