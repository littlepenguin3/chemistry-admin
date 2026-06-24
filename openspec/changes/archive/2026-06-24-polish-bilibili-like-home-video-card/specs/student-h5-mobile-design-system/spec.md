## ADDED Requirements

### Requirement: Home video overflow sheet is phone-safe
The student H5 mobile design system SHALL support a phone-safe bottom-sheet pattern for the home video card overflow menu without conflicting with root navigation, safe areas, or native home feed scrolling.

#### Scenario: Student opens a home video overflow menu
- **WHEN** a student taps the vertical-more overflow trigger on a home video card
- **THEN** the app MUST render the menu as a mobile sheet or equivalent phone-safe overlay
- **AND** the overlay MUST use the existing learning-page bottom-sheet visual language where practical
- **AND** the overlay MUST be constrained to the student mobile content width rather than spanning as a desktop modal
- **AND** the overlay MUST account for `env(safe-area-inset-bottom)` or the app's safe-area abstraction
- **AND** the overlay MUST appear above the bottom navigation and MUST prevent the bottom navigation from intercepting menu taps

#### Scenario: Overflow menu rows are touch-friendly
- **WHEN** home video overflow choices are visible on a 360px to 430px CSS-pixel-wide viewport
- **THEN** each menu row MUST have a phone-appropriate hit area
- **AND** row labels and icons MUST not overlap, clip, or require hover to understand
- **AND** disabled or unavailable rows MUST have a clear disabled treatment and MUST not look tappable

#### Scenario: Overflow overlay is dismissed
- **WHEN** the student taps the backdrop, selects a menu action, navigates away, presses Escape where supported, or otherwise closes the menu
- **THEN** the overlay MUST dismiss without changing the active root tab identity
- **AND** dismissing the overlay MUST NOT scroll the page unexpectedly
- **AND** dismissing the overlay MUST NOT trigger the underlying feed card navigation

#### Scenario: Home feed scrolling remains native with overlay closed
- **WHEN** no home video overflow sheet is open
- **THEN** the home feed MUST continue to use native document scrolling
- **AND** downward home scrolling MUST still compress the home header and bottom navigation through the existing app-shell behavior
- **AND** upward or top scrolling MUST still restore the home header and bottom navigation according to the existing app-shell behavior

#### Scenario: Mobile QA covers home video card polish
- **WHEN** mobile viewport QA runs for the home video card polish
- **THEN** QA MUST cover the home feed at 360x780, 390x844, and 430x932 CSS-pixel viewports where practical
- **AND** QA MUST verify title two-line protection, metadata one-line truncation, absence of green pill metadata chips, presence of at most one overflow trigger per card, overflow sheet reachability, safe-area spacing, and absence of page-level horizontal overflow
- **AND** QA MUST verify that tapping media or text opens point detail while tapping overflow opens the menu without navigating
