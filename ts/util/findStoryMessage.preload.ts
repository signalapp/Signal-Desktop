// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

import type { ServiceIdString } from '../types/ServiceId.std.js';
import type { DurationInSeconds } from './durations/duration-in-seconds.std.js';

// Minimal type stub for story messages
type StoryMessageStub = {
  id: string;
  sendStateByConversationId?: Record<string, { isAllowedToReplyToStory?: boolean } | null>;
  sourceServiceId?: ServiceIdString;
  expireTimer?: DurationInSeconds;
  expirationStartTimestamp?: number;
  storyDistributionListId?: string;
};

export function findStoryMessage(..._args: Array<unknown>): undefined {
  return undefined;
}

export function findStoryMessages(..._args: Array<unknown>): Array<StoryMessageStub> {
  return [];
}
