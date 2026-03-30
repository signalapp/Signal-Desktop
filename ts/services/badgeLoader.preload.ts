// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import { strictAssert } from '../util/assert.std.ts';
import { makeLookup } from '../util/makeLookup.std.ts';

import type { BadgeType } from '../badges/types.std.ts';
import type { BadgesStateType } from '../state/ducks/badges.preload.ts';

let badges: Array<BadgeType> | undefined;

export async function loadBadges(): Promise<void> {
  badges = await DataReader.getAllBadges();
}

export function getBadgesForRedux(): BadgesStateType {
  strictAssert(badges != null, 'badges have not been loaded');
  return {
    byId: makeLookup(badges, 'id'),
  };
}
