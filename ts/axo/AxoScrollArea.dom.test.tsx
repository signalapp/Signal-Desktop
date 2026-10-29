// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoScrollArea.dom.stories.tsx';

describe('AxoScrollArea', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Scrollable viewports need a `tabindex`, and a role and name to
      // announce when focused (Chromium focuses them anyway, see below).
      Vertical: ['scrollable-region-focusable'],
      VerticalWithHints: ['scrollable-region-focusable'],
      VerticalWithMask: ['scrollable-region-focusable'],
      Horizontal: ['scrollable-region-focusable'],
      HorizontalWithHints: ['scrollable-region-focusable'],
      HorizontalWithMask: ['scrollable-region-focusable'],
      Both: ['scrollable-region-focusable'],
      BothWithHints: ['scrollable-region-focusable'],
      BothWithMask: ['scrollable-region-focusable'],
    },
  });
});
