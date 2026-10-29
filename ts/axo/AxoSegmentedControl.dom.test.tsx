// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSegmentedControl.dom.stories.tsx';

describe('AxoSegmentedControl', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: `primary` AxoBadge text doesn't have enough contrast in dark mode
      WithBadges: ['color-contrast'],
      LongNamesWithBadges: ['color-contrast'],
    },
  });
});
