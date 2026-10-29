// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatDateSection.dom.stories.tsx';

describe('AxoChatDateSection', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: The story's scroll area can't be scrolled with the keyboard,
      // and its fake outgoing messages don't have enough contrast in dark mode
      Basic: ['scrollable-region-focusable', 'color-contrast'],
    },
  });
});
