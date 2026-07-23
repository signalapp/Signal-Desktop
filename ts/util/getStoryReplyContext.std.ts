// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  ReadonlyMessageAttributesType,
  StoryReplyContextType,
} from '../model-types.d.ts';
import { isAciString } from './isAciString.std.ts';
import { strictAssert } from './assert.std.ts';

export function getStoryReplyContext(
  storyMessage: Pick<ReadonlyMessageAttributesType, 'sourceServiceId'>
): StoryReplyContextType {
  const { sourceServiceId: authorAci } = storyMessage;
  strictAssert(isAciString(authorAci), 'Story message author must be an ACI');
  return { authorAci };
}
