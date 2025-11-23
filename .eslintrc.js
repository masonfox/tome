module.exports = {
  root: true,
  extends: ["next", "next/core-web-vitals"],
  rules: {
    // Disallow console usage entirely; prefer getLogger()
    "no-console": ["error", { allow: [] }],
    // Custom guidance: flag any direct console.* and suggest logger
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='console']",
        message: "Use getLogger() from '@/lib/logger' instead of console.* for structured logging",
      },
    ],
  },
  overrides: [
    {
      files: ["**/__tests__/**", "**/tests/**", "**/*.test.*"],
      rules: {
        // Tests can use console for debugging
        "no-console": "off",
      },
    },
    {
      files: ["**/*.disabled"],
      rules: {
        // Disabled legacy code ignored
        "no-console": "off",
      },
    },
  ],
};
