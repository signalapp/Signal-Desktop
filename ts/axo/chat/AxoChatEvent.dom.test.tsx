// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatEvent.dom.stories.tsx';

describe('AxoChatEvent', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: `discouraged` actions and the `destructive` variant don't have
      // enough contrast
      Variants: ['color-contrast'],
    },
  });
});
