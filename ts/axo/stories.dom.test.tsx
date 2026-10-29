// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import type { ImportGlobFunction } from 'vite/types/importGlob.d.ts';

type ImportMetaWithGlob = ImportMeta & { glob: ImportGlobFunction };

// Note: Vite only transforms literal `import.meta.glob()` calls. These are
// lazy, so only the file names are used and nothing is imported.
const STORIES = Object.keys(
  (import.meta as ImportMetaWithGlob).glob('./**/*.dom.stories.tsx')
);
const TESTS = new Set(
  Object.keys((import.meta as ImportMetaWithGlob).glob('./**/*.dom.test.tsx'))
);
const VISUAL_TESTS = new Set(
  Object.keys(
    (import.meta as ImportMetaWithGlob).glob('./**/*.dom.visual.test.tsx')
  )
);

describe('stories', () => {
  test('every component with stories has tests', () => {
    const missing = STORIES.map(file => {
      return file.replace('.dom.stories.tsx', '.dom.test.tsx');
    }).filter(file => !TESTS.has(file));
    // Call `testStoriesWithAxe()` from `_test-helpers/stories.dom.tsx` in them
    expect(missing).toStrictEqual([]);
  });

  test('every component with stories has visual tests', () => {
    const missing = STORIES.map(file => {
      return file.replace('.dom.stories.tsx', '.dom.visual.test.tsx');
    }).filter(file => !VISUAL_TESTS.has(file));
    // Call `testStoryScreenshots()` from `_test-helpers/stories.dom.tsx` in them
    expect(missing).toStrictEqual([]);
  });
});
