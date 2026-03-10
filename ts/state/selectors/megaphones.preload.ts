// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.js';
import type { MegaphonesStateType } from '../ducks/megaphones.preload.js';
import { getAbsoluteMegaphoneImageFilePath } from '../../util/migrations.preload.js';
import {
  MegaphoneType,
  type RemoteMegaphoneDisplayType,
  type VisibleRemoteMegaphoneType,
} from '../../types/Megaphone.std.js';
import type { StateSelector } from '../types.std.js';
import {
  isTestMegaphone,
  TEST_MEGAPHONE_IMAGE,
} from '../../util/getTestMegaphone.std.js';

export function getMegaphonesState(
  state: Readonly<StateType>
): MegaphonesStateType {
  return state.megaphones;
}

export const getVisibleMegaphones: StateSelector<
  ReadonlyArray<VisibleRemoteMegaphoneType>
> = createSelector(getMegaphonesState, state => {
  return state.visibleMegaphones;
});

export const getVisibleMegaphonesForDisplay: StateSelector<
  ReadonlyArray<RemoteMegaphoneDisplayType>
> = createSelector(getVisibleMegaphones, visibleMegaphones =>
  visibleMegaphones.map(megaphone => ({
    type: MegaphoneType.Remote,
    remoteMegaphoneId: megaphone.id,
    primaryCtaId: megaphone.primaryCtaId,
    secondaryCtaId: megaphone.secondaryCtaId,
    primaryCtaText: megaphone.primaryCtaText,
    secondaryCtaText: megaphone.secondaryCtaText,
    title: megaphone.title,
    body: megaphone.body,
    imagePath: isTestMegaphone(megaphone)
      ? TEST_MEGAPHONE_IMAGE
      : getAbsoluteMegaphoneImageFilePath(megaphone.imagePath),
  }))
);
