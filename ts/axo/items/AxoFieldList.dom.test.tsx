// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe } from 'vitest';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoFieldList.dom.stories.tsx';

describe('AxoFieldList', () => {
  testStoriesWithAxe(stories);
});
