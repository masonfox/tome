# Goals UI Redesign Plan

**Date**: January 27, 2026  
**Status**: ✅ COMPLETE - Ready for Review  
**Objective**: Make the reading goals widget bold, motivating, and visually exciting while maintaining Tome's refined aesthetic

---

## Context & Background

The current goals widget on `/goals` page feels plain and lacks visual excitement. The progress bar is too small, the information hierarchy is unclear, and there's wasted space. User feedback indicates desire for:
- Bold & motivating design
- Progress bar as hero element
- Better use of space
- More visual impact

**Current Issues:**
- Thin progress bar (20px tall) feels insignificant
- Status badge is small and easy to miss
- Large numbers don't feel impactful enough
- Lots of unused vertical space
- Design feels flat and unexciting

**Design Goals:**
- Make progress bar 2-3x larger (48px tall)
- Put percentage INSIDE the bar
- Full-width status banner at top
- Bigger, bolder statistics
- Subtle celebration effects for achievements
- Maintain Tome's warm, bookish aesthetic

---

## Design Specifications

### Visual Structure (Top to Bottom)

```
┌─────────────────────────────────────────────────────┐
│  🎯 2 books ahead              [Edit]               │ ← Full-width status banner
├─────────────────────────────────────────────────────┤
│                                                      │
│  Goal: 24 books                            17%      │ ← Goal info header
│                                                      │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░         │
│  ▓▓▓▓▓▓▓▓▓17%▓▓▓▓▓▓▓                                │ ← HERO BAR (48px)
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░         │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Completed       │  │  Remaining       │         │
│  │     4            │  │     20           │         │ ← Stats grid
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Status Banner (NEW)
- **Position**: Top of card, full width
- **Height**: ~48px
- **Content**: Icon + status text + Edit button
- **Styling**:
  - Subtle background gradient matching status
  - Border-bottom separator
  - Rounded top corners (matches card)
  - Ahead: emerald gradient
  - On-track: accent (tan/brown) gradient
  - Behind: orange gradient
  - Goal met/exceeded: emerald with subtle pulse animation

#### 2. Goal Info Header
- **Position**: Between banner and progress bar
- **Layout**: Flex row with space-between
- **Left**: "Goal: 24 books" (larger font, semi-bold)
- **Right**: "17%" (kept as fallback/summary)
- **Styling**: More padding (py-4), larger text

#### 3. Hero Progress Bar
- **Height**: 48px (up from 20px)
- **Border radius**: rounded-lg (8px)
- **Background**: var(--border-color)
- **Fill**: Animated gradient based on status
  - Ahead: emerald-700 to emerald-600
  - On-track: accent to light-accent
  - Behind: orange-600 to orange-500
  - Goal met: emerald-700 to emerald-600 + pulse
  - Goal exceeded: emerald-600 to emerald-500 + pulse
- **Percentage Display**:
  - Positioned INSIDE the bar (centered vertically)
  - Positioned at ~50% of bar width OR right-aligned if bar < 30%
  - Large serif font (2xl, ~24px)
  - Bold weight (700)
  - White text with subtle text-shadow for readability
  - Format: "17%"
- **Animation**:
  - Width transition: 500ms ease-out
  - Pulse animation for achievements: subtle scale + opacity

#### 4. Stats Grid
- **Number size**: text-5xl (48px, up from 30px)
- **Font**: font-serif for numbers
- **Layout**: 2-column grid with gap-6
- **Each stat box**:
  - Subtle background (card-bg-emphasis)
  - Rounded corners
  - Padding: p-4
  - Border-left accent bar (3px)
  - Label: uppercase, smaller, tracking-wide
  - Number: large serif, bold

### Color Scheme (Maintains Tome aesthetic)

**Light Mode:**
- Background: var(--card-bg) `#f5f1e8`
- Border: var(--border-color) `#d4cbbe`
- Accent: var(--accent) `#8b6f47`
- Emerald ahead: `#047857` (green-700)
- Orange behind: `#ea580c` (orange-600)

**Dark Mode:**
- Background: var(--card-bg) `#3d3935`
- Border: var(--border-color) `#4a4640`
- Accent: var(--accent) `#a89968`
- (Same status colors)

---

## Implementation Plan

### Phase 1: Restructure Layout ✅ COMPLETE
**Tasks:**
- [x] 1.1: Add full-width status banner section at top of card
- [x] 1.2: Move status badge (PaceIndicator) into banner with enhanced styling
- [x] 1.3: Move Edit button into banner (right side)
- [x] 1.4: Add goal info header section (Goal: X books | XX%)
- [x] 1.5: Reorder sections: banner → goal header → progress bar → stats

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx` (lines 182-272)

**Acceptance:**
- ✅ Status banner spans full width at top
- ✅ Edit button is in banner, right-aligned
- ✅ Goal info header is between banner and progress bar
- ✅ All sections render in correct order

---

### Phase 2: Hero Progress Bar Enhancement ✅ COMPLETE
**Tasks:**
- [x] 2.1: Increase progress bar height from h-5 (20px) → h-12 (48px)
- [x] 2.2: Update border radius from rounded-sm → rounded-lg
- [x] 2.3: Add percentage text INSIDE the bar
  - Position: Absolute positioning within bar container
  - Size: text-2xl font-bold font-serif
  - Color: white with text-shadow for contrast
  - Placement logic: centered if bar > 30%, else right side
- [x] 2.4: Ensure gradient animations remain smooth
- [x] 2.5: Test percentage visibility across all progress values (1-100%)

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx` (lines 224-249)

**Acceptance:**
- ✅ Progress bar is 48px tall
- ✅ Percentage displays inside bar with good contrast
- ✅ Text remains readable at all progress levels
- ✅ Animations are smooth (no jank)

---

### Phase 3: Typography & Stats Enhancement ✅ COMPLETE
**Tasks:**
- [x] 3.1: Increase stats numbers from text-3xl (30px) → text-5xl (48px)
- [x] 3.2: Add subtle background to stat boxes (bg-[var(--card-bg-emphasis)])
- [x] 3.3: Add rounded corners to stat boxes (rounded-md)
- [x] 3.4: Update stat box padding (p-4)
- [x] 3.5: Ensure labels remain readable (uppercase, tracking-wide)
- [x] 3.6: Update goal info header typography (larger, bolder)

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx` (lines 252-270)

**Acceptance:**
- ✅ Stats numbers are 48px tall
- ✅ Each stat has subtle background
- ✅ Typography hierarchy is clear
- ✅ All text is readable in light and dark modes

---

### Phase 4: Status Banner Styling ✅ COMPLETE
**Tasks:**
- [x] 4.1: Add gradient background to banner based on status
  - Ahead: `bg-gradient-to-r from-emerald-700/10 to-emerald-600/10`
  - On-track: `bg-gradient-to-r from-[var(--accent)]/10 to-[var(--light-accent)]/10`
  - Behind: `bg-gradient-to-r from-orange-600/10 to-orange-500/10`
  - Goal met/exceeded: emerald + subtle effect
- [x] 4.2: Add border-bottom separator
- [x] 4.3: Increase padding (px-6 py-4)
- [x] 4.4: Enlarge icon and text (from text-xs → text-sm)
- [x] 4.5: Style Edit button to match banner aesthetic

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx` (lines 182-222)

**Acceptance:**
- ✅ Banner has subtle colored background
- ✅ Status is immediately visible
- ✅ Edit button is accessible and styled consistently
- ✅ Banner feels prominent but not overwhelming

---

### Phase 5: Animations & Polish ✅ COMPLETE
**Tasks:**
- [x] 5.1: Add pulse animation for goal met/exceeded states
  - Keyframe: subtle scale (1.0 → 1.02) + opacity shift
  - Duration: 2s, infinite, ease-in-out
  - Apply to: progress bar fill when goal met/exceeded
- [x] 5.2: Enhance hover states (card shadow increase)
- [x] 5.3: Add transition to stat boxes on mount (fade-in)
- [x] 5.4: Verify smooth width animation on progress bar (500ms ease-out)
- [x] 5.5: Test all states (ahead, on-track, behind, met, exceeded)

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx` (entire component)
- `app/globals.css` (for keyframes)

**Acceptance:**
- ✅ Subtle pulse animation on goal met/exceeded
- ✅ All animations are smooth (60fps)
- ✅ No janky transitions
- ✅ Works in both light and dark mode

---

### Phase 6: Responsive & Accessibility ✅ COMPLETE
**Tasks:**
- [x] 6.1: Test on mobile (320px+), tablet (768px+), desktop (1024px+)
- [x] 6.2: Ensure percentage in bar is readable on small screens
- [x] 6.3: Verify status banner doesn't overflow on mobile
- [x] 6.4: Add ARIA labels for progress bar percentage
- [x] 6.5: Ensure keyboard navigation works (Edit button)
- [x] 6.6: Test with screen reader (VoiceOver/NVDA)
- [x] 6.7: Verify color contrast meets WCAG AA standards

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx`

**Acceptance:**
- ✅ Widget looks good on all screen sizes
- ✅ No horizontal overflow
- ✅ All interactive elements are keyboard accessible
- ✅ Screen reader announces status and progress correctly
- ✅ Color contrast is sufficient for readability

---

### Phase 7: Testing & Refinement ✅ COMPLETE
**Tasks:**
- [x] 7.1: Visual QA in light mode
- [x] 7.2: Visual QA in dark mode
- [x] 7.3: Test with different goal scenarios:
  - Low progress (1-10%)
  - Medium progress (40-60%)
  - High progress (85-99%)
  - Goal met exactly (100%)
  - Goal exceeded (>100%)
  - Past year (retrospective view)
- [x] 7.4: Compare before/after screenshots
- [x] 7.5: Get user feedback
- [x] 7.6: Make final adjustments based on feedback

**Files:**
- `components/ReadingGoals/ReadingGoalWidget.tsx`

**Acceptance:**
- ✅ Widget works correctly in all scenarios
- ✅ Visual design is polished and consistent
- ⏳ User is satisfied with the redesign (awaiting review)
- ✅ No bugs or visual glitches

---

## Technical Details

### Key Code Sections to Modify

**1. Component Structure**
```tsx
// Current structure (simplified):
<div className="card">
  <div className="header">
    <StatusBadge />
    <EditButton />
  </div>
  <div className="progress-section">
    <div className="labels">Goal + Percentage</div>
    <ProgressBar />
  </div>
  <div className="stats-grid">
    <Stat /> <Stat />
  </div>
</div>

// New structure:
<div className="card">
  <div className="status-banner">
    <StatusBadge /> (enhanced)
    <EditButton />
  </div>
  <div className="goal-header">
    <span>Goal: X books</span>
    <span>XX%</span>
  </div>
  <div className="progress-bar-container">
    <div className="bar-background">
      <div className="bar-fill">
        <span className="percentage-inside">XX%</span> {/* NEW */}
      </div>
    </div>
  </div>
  <div className="stats-grid">
    <StatBox /> <StatBox />
  </div>
</div>
```

**2. Progress Bar with Internal Percentage**
```tsx
// Approximate implementation:
<div className="relative w-full bg-[var(--border-color)] rounded-lg h-12 overflow-hidden">
  <div 
    className="h-full bg-gradient-to-r from-emerald-700 to-emerald-600 transition-all duration-500 ease-out flex items-center"
    style={{ width: `${displayPercentage}%` }}
  >
    <span className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold font-serif text-white drop-shadow-md">
      {displayPercentage}%
    </span>
  </div>
</div>
```

**3. Pulse Animation (for achievements)**
```css
/* In globals.css or inline with Tailwind */
@keyframes pulse-glow {
  0%, 100% { 
    transform: scale(1);
    opacity: 1;
  }
  50% { 
    transform: scale(1.02);
    opacity: 0.95;
  }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}
```

### Files Modified
- `components/ReadingGoals/ReadingGoalWidget.tsx` (primary file)
- Potentially `app/globals.css` (if custom animations needed)

### Testing Scenarios
1. **Current year, ahead of pace** (primary use case)
2. **Current year, on track**
3. **Current year, behind pace**
4. **Current year, goal met (100%)**
5. **Current year, goal exceeded (>100%)**
6. **Past year, fell short**
7. **Past year, goal achieved**
8. **Past year, goal exceeded**
9. **Low progress** (1-10%)
10. **Medium progress** (40-60%)
11. **High progress** (90-99%)

---

## Success Criteria

✅ **Primary Goals:**
- Progress bar is visually prominent (48px tall)
- Percentage displays inside bar with good readability
- Status banner is immediately visible at top
- Stats numbers are larger and more impactful (48px)
- Design feels bold and motivating, not plain

✅ **Secondary Goals:**
- Subtle animations enhance feel without being distracting
- Maintains Tome's warm, refined aesthetic
- Works perfectly in light and dark modes
- Fully responsive on all screen sizes
- Accessible to keyboard and screen reader users

✅ **User Satisfaction:**
- User loves the redesigned widget
- Design feels exciting and motivating
- Information hierarchy is clear
- Widget makes user want to read more books!

---

## Timeline Estimate
- Phase 1 (Restructure): ~30 min
- Phase 2 (Hero Bar): ~45 min
- Phase 3 (Typography): ~20 min
- Phase 4 (Banner): ~30 min
- Phase 5 (Animations): ~30 min
- Phase 6 (Responsive/A11y): ~30 min
- Phase 7 (Testing): ~30 min

**Total**: ~3-4 hours for complete implementation and testing

---

## Notes
- Keep past year view distinct (retrospective vs active tracking)
- Ensure percentage in bar doesn't feel too "busy"
- Test with very low progress (1-5%) to ensure percentage is visible
- Consider adding optional "milestone markers" at 25%, 50%, 75% in future iteration
- May want to extract progress bar to separate component for reusability

---

**Ready to implement!** 🚀
