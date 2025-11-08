---
name: playwright-ui-test
description: Launch Orbital Electron app and capture UI screenshots for visual inspection
---

# Playwright UI Testing Skill

This skill launches the Orbital Desktop Electron application using Playwright and captures screenshots of the UI for visual inspection and verification.

## Purpose

Give the UI/UX agent "eyes" to see what's actually being built in the Orbital app. Use this skill after making UI changes to:
- Verify components render correctly
- Capture visual state of threaded discussions
- Inspect layout and styling
- Document UI progress

## When to Use

- After implementing new UI components
- After modifying existing UI/UX code
- When verifying threading UI layout
- When troubleshooting visual issues
- When documenting UI implementation progress

## What This Skill Does

1. **Runs Playwright tests** that launch the Orbital Electron app
2. **Captures screenshots** of:
   - Main application window
   - Conversation/thread list
   - Orbital threading components
   - Other UI elements as specified
3. **Returns screenshot paths** so they can be read and analyzed
4. **Runs basic UI verification tests** to ensure the app loads correctly

## How to Use

When you invoke this skill, it will:

1. Launch the Orbital Electron application in test mode
2. Wait for the app to load
3. Capture screenshots of key UI components
4. Save screenshots to `test-results/screenshots/`
5. Return the paths to captured screenshots

## Commands

The skill executes the following:

```bash
# Run Playwright tests and capture screenshots
pnpm exec playwright test tests/playwright/orbital-ui.spec.ts --reporter=line

# Screenshots are saved to:
# - test-results/screenshots/main-window.png
# - test-results/screenshots/conversation-list.png
# - test-results/screenshots/orbital-thread-list.png
```

## Reading Screenshots

After running this skill, use the `Read` tool to view the captured screenshots:

```typescript
// Example: Read the main window screenshot
await tools.Read({
  file_path: '/Users/alexg/Documents/GitHub/Orbital-Desktop/test-results/screenshots/main-window.png'
});
```

## Output

The skill will report:
- Test execution status
- Screenshot file paths
- Any errors or failures encountered
- UI elements that were successfully captured

## Limitations

- Requires the Orbital app to be buildable and runnable
- Screenshots capture current state only (not interactive)
- May require app to be in specific state to capture certain views
- Test mode may differ slightly from production appearance

## Tips for UI/UX Agent

After invoking this skill:
1. Read the screenshot files to see actual rendered UI
2. Compare with design intentions
3. Identify visual issues or layout problems
4. Document what's working vs. what needs improvement
5. Use insights to plan next UI implementation steps
