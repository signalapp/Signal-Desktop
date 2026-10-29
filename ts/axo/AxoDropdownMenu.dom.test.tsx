// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoDropdownMenu.dom.stories.tsx';

describe('AxoDropdownMenu', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // axe counts item descriptions as part of their visible label
      WithItemDescriptions: ['label-content-name-mismatch'],
    },
  });
});
