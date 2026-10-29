// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vitest/config';
import type { TestProjectInlineConfiguration } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import tailwindcss from '@tailwindcss/vite';
import { axoBrowserCommands } from './ts/axo/_test-setup/setup-commands.std.mts';

const BROWSER_SETUP_FILES = [
  './stylesheets/tailwind-config.css',
  './stylesheets/manifest.scss',
  './ts/axo/_test-setup/setup.dom.tsx',
  './ts/axo/_test-setup/setup.css',
];

type BrowserConfig = NonNullable<
  NonNullable<TestProjectInlineConfiguration['test']>['browser']
>;

function browserConfig(overrides: BrowserConfig = {}): BrowserConfig {
  return {
    enabled: true,
    headless: true,
    provider: playwright({
      contextOptions: {
        // Keep dates, times, and number formatting the same on every machine
        locale: 'en-US',
        timezoneId: 'UTC',
        // Disable animations
        reducedMotion: 'reduce',
        // Enforce selectors match one element
        strictSelectors: true,
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
          name: 'axo-visual',
          include: ['ts/axo/**/*.dom.visual.test.{ts,tsx}'],
          setupFiles: BROWSER_SETUP_FILES,
          browser: browserConfig({
            // Traces double how long these take, and failures already save
            // the actual and diff images
            trace: 'off',
            expect: {
              toMatchScreenshot: {
                comparatorName: 'pixelmatch',
                comparatorOptions: {
                  // Anti-aliased pixels are already ignored, any other
                  // changed pixel is a real change
                  threshold: 0.1,
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
