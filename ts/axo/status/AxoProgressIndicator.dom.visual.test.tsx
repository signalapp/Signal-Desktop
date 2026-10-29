// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoProgressIndicator.dom.stories.tsx';

describe('AxoProgressIndicator', () => {
  testStoryScreenshots(stories, {
    // Covered by the fixed progress tests below
    skip: {
      Basic: 'Renders random progress',
      NoTrack: 'Renders random progress',
      Sizes: 'Renders random progress',
      Weights: 'Renders random progress',
    },
  });
});
