// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists.preload.js';

export async function loadDistributionLists(): Promise<void> {
  // No-op - Stories feature removed
}

export function getDistributionListsForRedux(): Array<StoryDistributionListDataType> {
  return [];
}
