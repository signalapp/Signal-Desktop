// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoMessage.dom.stories.tsx';

describe('AxoMessage', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Text in outgoing bubbles doesn't have enough contrast
      Basic: ['color-contrast'],
      OutgoingStatus: ['color-contrast'],
      PartiallySent: ['color-contrast'],
    },
  });
});
