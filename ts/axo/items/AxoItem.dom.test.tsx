// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoItem.dom.stories.tsx';

describe('AxoItem', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Destructive labels don't have enough contrast in light mode
      Destructive: ['color-contrast'],
      // TODO: axe doesn't treat disabled item text as exempt, because it
      // isn't inside of the `aria-disabled` trigger
      Disabled: ['color-contrast'],
    },
  });
});
