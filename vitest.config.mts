// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { axoBrowserCommands } from './ts/axo/_test-setup/setup-commands.std.mts';
import {
  OrphanedScreenshotsReporter,
  resolveScreenshotPath,
} from './ts/axo/_test-setup/orphaned-screenshots.node.mts';

const VISUAL_PROJECT_NAME = 'axo-visual';

const BROWSER_SETUP_FILES = [
  './stylesheets/tailwind-config.css',
  './stylesheets/manifest.scss',
  './ts/axo/_test-setup/setup.dom.tsx',
  './ts/axo/_test-setup/setup.css',
];

/**
 * `--update` only replaces screenshots that don't match, so it needs a lower
 * threshold to save subtle changes like a faint shadow. Using the same
 * threshold for every run would make tests fail on tiny rendering differences.
 */
const IS_UPDATING_SCREENSHOTS = process.argv.some(arg => {
  return arg === '-u' || arg === '--update' || arg.startsWith('--update=');
});

type BrowserConfig = NonNullable<
  NonNullable<TestProjectInlineConfiguration['test']>['browser']
>;

type BrowserConfigOverrides = BrowserConfig &
  Readonly<{
    deviceScaleFactor?: number;
  }>;

function browserConfig({
  deviceScaleFactor = 1,
  ...overrides
}: BrowserConfigOverrides = {}): BrowserConfig {
  return {
    enabled: true,
    headless: true,
    provider: playwright({
      launchOptions: {
        // Headless Chromium on Linux snaps glyphs to whole pixels by default,
        // which makes the spacing between letters uneven
        args: ['--font-render-hinting=none'],
      },
      contextOptions: {
        // Keep dates, times, and number formatting the same on every machine
        locale: 'en-US',
        timezoneId: 'UTC',
        // Disable animations
        reducedMotion: 'reduce',
        // Enforce selectors match one element
        strictSelectors: true,
        deviceScaleFactor,
      },
    }),
    instances: [{ browser: 'chromium' }],
    viewport: { width: 1024, height: 768 },
    commands: axoBrowserCommands,
    // Saved to `__traces__/` next to the test file, view with:
    // pnpm exec playwright show-trace <path>
    trace: 'retain-on-failure',
    ...overrides,
  };
}

export default defineConfig({
  plugins: [tailwindcss()],
  css: {
    preprocessorOptions: {
      scss: {
        // Same as Storybook, loads fonts over http instead of `asset://`
        additionalData: '$is-storybook: true;',
      },
    },
  },
  optimizeDeps: {
    // Discover all of the dependencies of components upfront, otherwise Vite
    // finds them mid-run and reloads the page, which can cause flakiness
    entries: ['ts/axo/**/*.{std,dom}.{ts,tsx}'],
  },
  test: {
    pool: 'threads',
    reporters: [
      // Vitest's defaults, which are replaced when setting `reporters`
      'default',
      ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions'] : []),
      new OrphanedScreenshotsReporter({ projectName: VISUAL_PROJECT_NAME }),
    ],
    // Test files can't use hooks, so mocks, globals, and env variables are
    // reset automatically before each test
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    // The slowest test on CI takes about 6s, keep failures from waiting much
    // longer than that (browser mode defaults to 15s)
    testTimeout: 10_000,
    expect: {
      // Fail tests that never make an assertion, like when a check() helper
      // isn't called
      requireAssertions: true,
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'axo-node',
          environment: 'node',
          include: ['ts/axo/**/*.{std,node}.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'axo-browser',
          include: ['ts/axo/**/*.dom.test.{ts,tsx}'],
          benchmark: {
            include: ['ts/axo/**/*.{std,dom}.bench.{ts,tsx}'],
          },
          setupFiles: BROWSER_SETUP_FILES,
          browser: browserConfig(),
        },
      },
      {
        // Visual regression tests are kept in their own project because
        // reference screenshots are platform specific.
        extends: true,
        test: {
          name: VISUAL_PROJECT_NAME,
          include: ['ts/axo/**/*.dom.visual.test.{ts,tsx}'],
          setupFiles: BROWSER_SETUP_FILES,
          browser: browserConfig({
            // Traces double how long these take, and failures already save
            // the actual and diff images
            trace: 'off',
            // Match HiDPI displays so that 0.5px borders and subpixel text
            // positioning are rendered the same way most users see them
            deviceScaleFactor: 2,
            expect: {
              toMatchScreenshot: {
                resolveScreenshotPath,
                comparatorName: 'pixelmatch',
                comparatorOptions: {
                  // How different a pixel's color can be before it counts as
                  // changed: 0.1 allows about ±25 brightness levels, 0.01
                  // about ±2. Anti-aliased pixels are ignored either way.
                  threshold: IS_UPDATING_SCREENSHOTS ? 0.01 : 0.1,
                },
              },
            },
          }),
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['ts/axo/**/*.{ts,tsx}'],
      exclude: [
        'ts/axo/**/*.stories.tsx',
        'ts/axo/**/*.test.{ts,tsx}',
        'ts/axo/**/*.bench.{ts,tsx}',
        'ts/axo/_storybook-helpers/**',
        'ts/axo/_test-helpers/**',
        'ts/axo/_test-setup/**',
      ],
    },
  },
});
