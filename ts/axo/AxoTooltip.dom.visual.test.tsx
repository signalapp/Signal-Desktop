// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoTooltip.dom.stories.tsx';

describe('AxoTooltip', () => {
  // TODO: In `Sides`, tooltips that don't fit beside the trigger are cut off
  // by the window instead of moving to the top or bottom.
  testStoryScreenshots(stories);
});
