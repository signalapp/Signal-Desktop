# Playwright UI Tests for Orbital

This directory contains Playwright tests for the Orbital Desktop application, enabling visual testing and UI verification.

## Purpose

These tests launch the Orbital Electron app and capture screenshots for:
- Visual inspection of UI components
- Verification of threading UI implementation
- Documentation of UI progress
- Automated UI regression testing

## Running Tests

### Basic Test Run
```bash
pnpm test:playwright
```

### Interactive UI Mode
```bash
pnpm test:playwright:ui
```

### Capture Screenshots Only
```bash
pnpm test:playwright:screenshots
```

## Screenshot Output

Screenshots are saved to:
```
test-results/screenshots/
├── main-window.png
├── conversation-list.png
└── orbital-thread-list.png
```

## Available Tests

### `orbital-ui.spec.ts`
Main UI test suite that:
- Launches the Orbital Electron app
- Captures screenshots of key views
- Verifies app loads correctly
- Tests Orbital threading components

## Integration with Claude Code

The UI/UX agent can use the `playwright-ui-test` skill to:
1. Run these tests automatically
2. Capture screenshots after UI changes
3. Read and analyze screenshots visually
4. Verify implementation matches design intentions

## Adding New Tests

To add new UI tests:

1. Create a new test file in `tests/playwright/`
2. Follow the pattern in `orbital-ui.spec.ts`
3. Use descriptive test names
4. Capture screenshots for visual verification
5. Update this README with new test descriptions

## Requirements

- Playwright installed: `pnpm add -D @playwright/test`
- Chromium browser installed: `pnpm exec playwright install chromium`
- Orbital app must be buildable

## Troubleshooting

**App won't launch:**
- Ensure the app builds successfully
- Check that Electron is properly installed
- Verify `NODE_ENV=test` is supported

**Screenshots are blank:**
- Wait for app to fully load before capturing
- Check for console errors in test output
- Verify selectors match actual DOM structure

## Related Documentation

- [Playwright Docs](https://playwright.dev/)
- [Playwright Skill](../../.claude/skills/playwright-ui-test.md)
- [UI/UX Agent](../../.claude/agents/frontend-uiux-engineer.md)
