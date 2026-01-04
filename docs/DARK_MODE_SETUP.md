# Theme Settings

## Overview
Tome offers a flexible theme system with three options:
- **Light Mode**: Always use light theme regardless of system preference
- **Dark Mode**: Always use dark theme regardless of system preference
- **Auto Mode** (Default): Automatically match your system's theme preference and respond to changes in real-time

## Features

### Light Mode
- **Background**: Warm beige (#F0EAE3)
- **Foreground**: Dark brown (#3a3a3a)
- **Card Background**: Soft cream (#f5f1e8)
- **Accent**: Earthy brown (#8b6f47)

### Dark Mode
- **Background**: Deep charcoal (#1f1c19)
- **Foreground**: Warm beige (#e8dcc4)
- **Card Background**: Dark brown (#3d3935)
- **Accent**: Golden brown (#a89968)

### Auto Mode
Auto mode continuously monitors your operating system's theme preference and updates the app's theme in real-time:
- If your OS is set to dark mode, Tome will use dark theme
- If your OS is set to light mode, Tome will use light theme
- When your OS switches themes (e.g., at sunset), Tome automatically updates

This provides a seamless experience that matches your system-wide theme preferences.

## How to Change Theme

1. Navigate to **Settings** from the sidebar or bottom navigation
2. In the **Theme** section, select your preferred option:
   - **Light**: Always light mode
   - **Dark**: Always dark mode
   - **Auto**: Match system preferences (recommended)
3. When Auto is selected, you'll see which theme is currently active

Your preference is saved and will persist across sessions.

## Technical Implementation

### Settings Page Control
The theme is controlled exclusively through the Settings page (`app/settings/page.tsx`) using the `ThemeSettings` component. This provides a clear, explicit interface with radio buttons for the three theme options.

### Theme Hook (`hooks/useTheme.ts`)
The theme system is managed by the `useTheme` hook which:
- **Three-state preference**: Stores user preference as "light" | "dark" | "auto"
- **Computed effective theme**: Determines actual theme to display based on preference and system
- **Real-time listener**: Uses `matchMedia` to detect system theme changes when in auto mode
- **localStorage persistence**: Saves preference under key "themePreference"
- **Migration**: Automatically migrates from old boolean "darkMode" format

```typescript
export type ThemePreference = "light" | "dark" | "auto";
export type Theme = "light" | "dark";

const { 
  preference,      // User's selected preference
  effectiveTheme,  // Actual theme being displayed
  setThemePreference 
} = useTheme();
```

### Settings Component (`components/ThemeSettings.tsx`)
Radio button UI that allows users to:
- Select between Light, Dark, and Auto modes
- See descriptions of each option
- View current effective theme when in Auto mode

The component uses custom-styled radio buttons with the app's accent color for a cohesive design.

### Initial Load (`app/layout.tsx`)
An inline script runs before page load to:
- Check for saved theme preference in localStorage
- Migrate old boolean format if present
- Determine effective theme (handles "auto" by checking system preference)
- Apply theme attributes to prevent flash of incorrect theme
- Default to "auto" for new users

```javascript
// Prevents flash of wrong theme on initial load
const savedPreference = localStorage.getItem("themePreference");
let preference = "auto"; // Default for new users

if (preference === "auto") {
  theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
```

### Theme Application (`app/globals.css`)
Themes are applied using CSS custom properties (variables) that change based on the `data-theme` attribute:

```css
html[data-theme="dark"] {
  --background: #1f1c19;
  --foreground: #e8dcc4;
  /* ... other variables */
}

html[data-theme="light"] {
  --background: #F0EAE3;
  --foreground: #3a3a3a;
  /* ... other variables */
}
```

All components use these CSS variables, so theme changes are instant and consistent.

## Migration from Previous Version

Users upgrading from the old toggle-based theme system:
- Old `darkMode: "true"` → migrates to `themePreference: "dark"`
- Old `darkMode: "false"` → migrates to `themePreference: "light"`
- Old localStorage key is automatically removed after migration
- New users default to `themePreference: "auto"`

Migration happens automatically in both the initial load script and the React hook.

## Browser Compatibility

Works on all modern browsers that support:
- CSS custom properties (variables)
- localStorage API
- matchMedia API for system preference detection

The implementation gracefully handles:
- Browsers without matchMedia (falls back to user's explicit preference or default)
- Disabled localStorage (theme works but doesn't persist)
- Server-side rendering (inline script ensures correct theme before hydration)

## Default Behavior

**New users**: Default to Auto mode, matching system preference
**Existing users**: Preference is preserved through migration
**No preference + no system preference**: Falls back to light mode
