---
phase: 02-icon-replacement
plan: 01
subsystem: ui
tags: [slds, icons, svg, vite]

# Dependency graph
requires:
  - phase: 01-02
    provides: "icons.js with SLDS imports and processSvg helper"
provides:
  - "icons.clock - SLDS clock icon for trace flag buttons"
  - "icons.settings - SLDS settings icon for utility buttons"
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: [src/lib/icons.js]

key-decisions:
  - "Use 16px size for button-icon replacements matching existing icon sizes"

patterns-established: []

# Metrics
duration: 1min
completed: 2026-01-16
---

# Phase 02 Plan 01: Extend Icon Library for Button-Icon Migration Summary

**Added clock and settings SLDS icons to icons.js for replacing HTML entity button icons**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-16T03:52:45Z
- **Completed:** 2026-01-16T03:53:28Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Mapped HTML entities to SLDS icon equivalents (clock, settings, refresh, threedots_vertical)
- Added clock and settings icon imports from @salesforce-ux/icons
- Extended icons object with icons.clock and icons.settings at 16px sizing
- Total unique SLDS icons now: 8 (6 existing + 2 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Map HTML entities to SLDS icons** - No commit (exploration/documentation only)
2. **Task 2: Add clock and settings icons to icons.js** - `6aeeb88` (feat)

**Plan metadata:** Will be committed with SUMMARY and STATE updates.

## Icon Entity Mapping

| HTML Entity | Unicode | Visual | SLDS Icon | Status |
|-------------|---------|--------|-----------|--------|
| &#128337;   | U+1F551 | clock  | clock.svg | Added |
| &#9881;     | U+2699  | gear   | settings.svg | Added |
| &#8635;     | U+21BB  | refresh | refresh.svg | Already available |
| &#8942;     | U+22EE  | vdots  | threedots_vertical.svg | Already available |

## Files Created/Modified

- `src/lib/icons.js` - Added clock and settings icon imports from SLDS

## Decisions Made

- Used 16px size for clock and settings icons to match existing button-icon sizes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 01 complete. Ready for remaining plans in Phase 2.

**What's ready:**
- icons.clock and icons.settings available for use in button-icon components
- All 4 HTML entity icons now have SLDS equivalents (2 pre-existing, 2 added)

**Next step:** Plan 02 will replace HTML entities in Events tab with SLDS icons.

---
*Phase: 02-icon-replacement*
*Completed: 2026-01-16*
