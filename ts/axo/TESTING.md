<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# Testing Axo

## Commands

| Command                   | Description                      |
| ------------------------- | -------------------------------- |
| `pnpm test:axo`           | Run all tests once               |
| `pnpm test:axo AxoSelect` | Run test files matching a filter |
| `pnpm test:axo -u`        | Update snapshots                 |
| `pnpm test:axo:watch`     | Watch mode                       |
| `pnpm test:axo:ui`        | Vitest UI                        |
| `pnpm test:axo:visual`    | Visual regression tests          |
| `pnpm test:axo:bench`     | Benchmarks                       |
| `pnpm test:axo:coverage`  | Coverage report                  |

Add `--browser.headless=false` to watch browser tests run.

## Files

Tests live next to the code they test, and the file suffix decides where they
run:

| File                      | Runs in | Vitest Project |
| ------------------------- | ------- | -------------- |
| `Foo.std.test.ts`         | Node    | axo-node       |
| `Foo.dom.test.tsx`        | Browser | axo-browser    |
| `Foo.dom.visual.test.tsx` | Browser | axo-visual     |
| `Foo.{std,dom}.bench.ts`  | Browser | axo-browser    |

Components with stories are required to have both:

- A `.dom.test.tsx` file that runs `testStoriesWithAxe()`
- A `.dom.visual.test.tsx` file that runs `testStoryScreenshots()`

```tsx
// Foo.dom.test.tsx
testStoriesWithAxe(stories, {
  knownViolations: {
    // TODO: Explain what needs to be fixed
    Basic: ['color-contrast'],
  },
});

// Foo.dom.visual.test.tsx
testStoryScreenshots(stories);
```

Use `<Story.AutoTrigger>` in stories to show menus and dialogs open.

## Component tests

Test what Axo adds on top of libraries like Radix, not the libraries
themselves.

```tsx
test("can't be toggled when disabled", async () => {
  const onCheckedChange = vi.fn();
  const screen = await renderAxo(
    <AxoSwitch.Root label="Wi-Fi" disabled checked={false} onCheckedChange={onCheckedChange} />
  );
  await screen.getByRole('switch', { name: 'Wi-Fi' }).click();
  expect(onCheckedChange).not.toHaveBeenCalled();
});
```

- Portalled content (menus, dialogs, tooltips) is outside of `screen`, find it
  with `page` from `vitest/browser`.
- Use `await expect.element(locator)` for assertions on the DOM.
- For known bugs, write the test for the correct behavior and mark it with
  `test.fails()` and a `TODO`.
- See [`_test-helpers/`](./_test-helpers/) for accessibility helpers.

## Visual regression tests

Reference screenshots in `__screenshots__/` depend on the platform, so they're
only generated on Linux in GitHub Actions, the same environment that CI compares
them in.

To update them, add the `update-screenshots` label to your pull request. The
"Update Visual Regression Screenshots" workflow commits any changed screenshots
to the branch, adds the `updated-screenshots` label, and removes the
`update-screenshots` label so it can be added again. Review the screenshots
before merging.

When a story or test is renamed or removed, CI fails until its old screenshots
are deleted. Delete the files it lists, or add the `update-screenshots` label
to delete them automatically.

Running `pnpm test:axo:visual` locally on macOS or Windows creates screenshots
for that platform, which are ignored by git.

## Debugging failures

Failing browser tests print the ARIA tree of the page, the path to a
screenshot of the page, and the path to a Playwright trace that can be opened
with `pnpm exec playwright show-trace <path>`.
