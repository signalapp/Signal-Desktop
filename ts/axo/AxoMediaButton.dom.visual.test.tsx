// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoMediaButton.dom.stories.tsx';

describe('AxoMediaButton', () => {
  testStoryScreenshots(stories);
});
