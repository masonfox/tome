# Dark Mode Toggle Setup

## Overview
A light/dark mode toggle has been added to the navigation bar. The implementation includes:

1. **Automatic Detection**: The app respects the system's color scheme preference on first load
2. **Manual Toggle**: Users can click the Sun/Moon icon in the top-right of the navigation to switch modes
3. **Persistence**: The user's choice is saved to localStorage and persists across sessions
4. **Smooth Transitions**: CSS transitions provide smooth color changes

## Features

### Light Mode (Default)
- **Background**: Warm beige (#e8dcc4)
- **Foreground**: Dark brown (#3a3a3a)
- **Card Background**: Soft cream (#f5f1e8)
- **Accent**: Earthy brown (#8b6f47)

### Dark Mode
- **Background**: Deep charcoal (#2a2622)
- **Foreground**: Warm beige (#e8dcc4)
- **Card Background**: Dark brown (#3d3935)
- **Accent**: Golden brown (#a89968)

## How It Works

### Toggle Button
Located in the navigation bar on the right side:
- **Sun icon** (☀️): Indicates dark mode is active, click to switch to light mode
- **Moon icon** (🌙): Indicates light mode is active, click to switch to dark mode

### Technical Implementation

1. **Navigation Component** (`components/Navigation.tsx`)
   - Uses React `useState` and `useEffect` hooks
   - Detects system preference via `window.matchMedia("(prefers-color-scheme: dark)")`
   - Stores preference in localStorage under key "darkMode"
   - Applies theme by setting `color-scheme` style attribute on `<html>`

2. **Global Styles** (`app/globals.css`)
   - Defines CSS variables for all colors
   - Uses `@media (prefers-color-scheme: dark)` for system preference fallback
   - Supports manual override via `html[style*="dark"]` selector
   - Smooth transitions on background-color and color changes

## Usage

1. **First Visit**: The app automatically detects your system preference
2. **Manual Toggle**: Click the Sun/Moon icon in the top navigation to switch modes
3. **Across Sessions**: Your preference is automatically restored when you return

## Browser Compatibility

Works on all modern browsers that support:
- CSS custom properties (variables)
- localStorage API
- matchMedia API

The implementation gracefully falls back to system preference if localStorage is unavailable.

## Notes

- The toggle is only visible after the component mounts (prevents hydration mismatch)
- Transitions are smooth with 0.3s duration
- All semantic colors are automatically applied throughout the app via CSS variables
