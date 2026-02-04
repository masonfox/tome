module.exports = {
  root: true,
  extends: ["next", "next/core-web-vitals"],
  rules: {
    // Disallow console usage entirely; prefer getLogger()
    "no-console": "error",
    // Custom guidance: flag any direct console.* and suggest logger
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[object.name='console']",
        message: "Use getLogger() from '@/lib/logger' instead of console.* for structured logging",
      },
      {
        // ADR-014: Prevent converting calendar date strings to Date objects in frontend
        selector: "NewExpression[callee.name='Date'][arguments.0.type='MemberExpression'][arguments.0.property.name=/(startedDate|completedDate|progressDate|dnfDate|startDate|endDate)/]",
        message: "ADR-014 violation: Do not convert YYYY-MM-DD calendar date strings to Date objects in frontend. Use the string directly or use parse() from date-fns for formatting.",
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
      files: ["lib/services/**", "lib/repositories/**", "app/api/**"],
      rules: {
        // Backend can use Date objects for comparisons and sorting
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[object.name='console']",
            message: "Use getLogger() from '@/lib/logger' instead of console.* for structured logging",
          },
        ],
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
