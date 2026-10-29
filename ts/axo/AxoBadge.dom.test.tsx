// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoBadge.dom.stories.tsx';

describe('AxoBadge', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Primary badge count text doesn't have enough contrast in dark mode
      Digits: ['color-contrast'],
      Max: ['color-contrast'],
    },
  });
});
