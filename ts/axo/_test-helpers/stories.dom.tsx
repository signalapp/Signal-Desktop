// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { commands, page } from 'vitest/browser';
import { cleanup } from 'vitest-browser-react';
import { renderAxo } from './render.dom.tsx';
import type { AxoTestTheme } from './render.dom.tsx';
import { formatAxeViolations, getAxeViolations } from './a11y.dom.tsx';
import { emulateMedia } from './media.dom.tsx';

/** A `*.dom.stories.tsx` module, imported with `import * as stories` */
export type StoriesModule = Readonly<{
  default: Readonly<{ title: string }>;
  [exportName: string]: unknown;
}>;

type Story = Readonly<{
  name: string;
  Component: ComponentType;
}>;

function getStories(storiesModule: StoriesModule): ReadonlyArray<Story> {
  const stories: Array<Story> = [];
  for (const [name, value] of Object.entries(storiesModule)) {
    if (/^[A-Z]/.test(name) && typeof value === 'function') {
      stories.push({ name, Component: value as ComponentType });
    }
  }
  return stories;
}

const THEMES: ReadonlyArray<AxoTestTheme> = ['light', 'dark'];

/**
 * Waits for images to load and skips to the end of animations like dialog
 * enter transitions, so that checks run against the final state.
 */
async function settle(): Promise<void> {
  await Promise.allSettled(
    Array.from(document.images, image => {
      // Lazy images outside of the viewport never load otherwise
      // oxlint-disable-next-line no-param-reassign
      image.loading = 'eager';
      return image.decode();
    })
  );

  // Let React render updates from `onLoad` handlers on images, and let
  // `ResizeObserver` callbacks update layouts (like stacked `AxoItem`s).
  // Those run after `requestAnimationFrame` callbacks in the same frame, so
  // also wait for the rest of the frame.
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });

  for (const animation of document.getAnimations()) {
    // Scroll-driven and infinite animations can't be finished
    if (
      animation.timeline === document.timeline &&
      animation.effect?.getComputedTiming().endTime !== Infinity
    ) {
      animation.finish();
    }
  }
}

export type StoryAxeOptions = Readonly<{
  /**
   * axe rules that currently fail, keyed by story name. Every entry should
   * have a TODO comment explaining what needs to be fixed.
   */
  knownViolations?: Partial<Record<string, ReadonlyArray<string>>>;
}>;

/**
 * Runs axe-core against every story in light and dark mode.
 *
 * Fails if there are violations that aren't listed in `knownViolations`, and
 * if any listed violations no longer happen (so they can be removed).
 *
 * @example
 * ```tsx
 * import * as stories from './AxoBadge.dom.stories.tsx';
 *
 * testStoriesWithAxe(stories, {
 *   knownViolations: {
 *     // TODO: Badge text doesn't have enough contrast in dark mode
 *     Digits: ['color-contrast'],
 *   },
 * });
 * ```
 */
export function testStoriesWithAxe(
  storiesModule: StoriesModule,
  options: StoryAxeOptions = {}
): void {
  describe('stories (axe)', () => {
    for (const story of getStories(storiesModule)) {
      test(story.name, async () => {
        const { Component } = story;
        const knownViolations = new Set(
          options.knownViolations?.[story.name] ?? []
        );
        const foundKnownViolations = new Set<string>();
        const errors: Array<string> = [];

        for (const theme of THEMES) {
          // oxlint-disable-next-line no-await-in-loop
          await renderAxo(<Component />, { theme });
          // oxlint-disable-next-line no-await-in-loop
          await settle();
          // Check the whole page to include portalled content
          // oxlint-disable-next-line no-await-in-loop
          const violations = await getAxeViolations(document.body);
          const unknownViolations = violations.filter(violation => {
            if (knownViolations.has(violation.id)) {
              foundKnownViolations.add(violation.id);
              return false;
            }
            return true;
          });
          if (unknownViolations.length > 0) {
            errors.push(
              `Found axe violations in ${theme} mode:\n\n${formatAxeViolations(unknownViolations)}`
            );
          }
          // oxlint-disable-next-line no-await-in-loop
          await cleanup();
        }

        const fixedViolations = Array.from(knownViolations).filter(rule => {
          return !foundKnownViolations.has(rule);
        });
        if (fixedViolations.length > 0) {
          errors.push(
            `These \`knownViolations\` no longer happen, remove them: ${fixedViolations.join(', ')}`
          );
        }

        // Always asserts, so it counts towards `expect.requireAssertions`
        expect(errors.join('\n\n')).toBe('');
      });
    }
  });
}

type ScreenshotMode = 'light' | 'dark' | 'forced-colors';

// Should match `browser.viewport` in vitest.config.mts
const VIEWPORT = { width: 1024, height: 768 };

const SCREENSHOT_MODES: ReadonlyArray<ScreenshotMode> = [
  'light',
  'dark',
  'forced-colors',
];

/**
 * Stories that render content into a portal (like an open dialog or tooltip)
 * need a screenshot of the whole page, otherwise just the rendered container.
 */
function getScreenshotTarget(container: HTMLElement): HTMLElement {
  // Portals are often empty wrappers around fixed position content, so look
  // for any visible element outside of the container.
  const hasPortalledContent = Array.from(
    document.body.querySelectorAll('*')
  ).some(element => {
    if (
      container.contains(element) ||
      // Hidden elements used by `<AxoProvider>` to measure scrollbars
      element.closest('[data-scrollbar-gutters-observer]') != null
    ) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const isEmpty = container.getBoundingClientRect().height === 0;
  return hasPortalledContent || isEmpty ? document.body : container;
}

export type StoryScreenshotOptions = Readonly<{
  /**
   * Stories that can't have stable screenshots, keyed by story name, with
   * the reason why.
   */
  skip?: Partial<Record<string, string>>;
}>;

/**
 * Takes a screenshot of every story in light mode, dark mode, and forced
 * colors mode, and compares them against the reference screenshots.
 *
 * @example
 * ```tsx
 * import * as stories from './AxoBadge.dom.stories.tsx';
 *
 * testStoryScreenshots(stories);
 * // or
 * testStoryScreenshots(stories, {
 *   skip: { Random: 'Renders random values' },
 * });
 * ```
 */
export function testStoryScreenshots(
  storiesModule: StoriesModule,
  options: StoryScreenshotOptions = {}
): void {
  describe('stories (screenshots)', () => {
    beforeEach(async () => {
      // Don't leave elements hovered from a previous test
      await commands.resetPointer();
      // Keep dates and relative times rendered by stories stable
      vi.useFakeTimers({
        toFake: ['Date'],
        now: new Date('2026-01-15T12:00:00Z'),
      });
    });

    afterEach(async () => {
      // Unmount first so timers started by the story don't see `Date` jump
      await cleanup();
      vi.useRealTimers();
      await page.viewport(VIEWPORT.width, VIEWPORT.height);
    });

    for (const mode of SCREENSHOT_MODES) {
      describe(mode, () => {
        for (const story of getStories(storiesModule)) {
          test(story.name, async context => {
            const skipReason = options.skip?.[story.name];
            if (skipReason != null) {
              context.skip(skipReason);
            }

            // `settle()` below only covers CSS and Web Animations, JS
            // animations (like `motion` layout animations) respect reduced motion
            await emulateMedia({
              reducedMotion: 'reduce',
              forcedColors: mode === 'forced-colors' ? 'active' : 'none',
            });

            const { Component } = story;
            const screen = await renderAxo(<Component />, {
              theme: mode === 'dark' ? 'dark' : 'light',
            });
            await settle();

            const target = getScreenshotTarget(screen.container);

            // Content outside of the viewport isn't painted, so make sure large
            // stories fit inside of it.
            const width = Math.max(VIEWPORT.width, target.scrollWidth);
            const height = Math.max(VIEWPORT.height, target.scrollHeight);
            if (width > VIEWPORT.width || height > VIEWPORT.height) {
              await page.viewport(width, height);
            }

            await expect(page.elementLocator(target)).toMatchScreenshot(
              `${story.name}-${mode}`,
              {
                screenshotOptions: {
                  // `settle()` already finished animations. Playwright would
                  // also cancel scroll-driven animations, like the edge
                  // shadows in AxoScrollArea.
                  animations: 'allow',
                  // Forced colors overrides the `caret-color` that Playwright
                  // uses to hide carets, so always show them instead. They
                  // don't blink because of `caret-animation` in setup.css.
                  caret: 'initial',
                },
              }
            );
          });
        }
      });
    }
  });
}
