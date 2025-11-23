module.exports = {
  root: true,
  extends: ["next", "next/core-web-vitals"],
  rules: {
    // Disallow console usage to enforce structured logging
    // Allow console in tests only (handled via overrides below)
    "no-console": ["error", { allow: [] }],
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
