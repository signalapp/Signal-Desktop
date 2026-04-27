// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { StateType } from '../reducer.preload.ts';
import type { MegaphonesStateType } from '../ducks/megaphones.preload.ts';
import { getAbsoluteMegaphoneImageFilePath } from '../../util/migrations.preload.ts';
import {
  MegaphoneType,
  type RemoteMegaphoneDisplayType,
  type VisibleRemoteMegaphoneType,
} from '../../types/Megaphone.std.ts';
import type { StateSelector } from '../types.std.ts';
import {
  isTestMegaphone,
  TEST_MEGAPHONE_IMAGE,
} from '../../util/getTestMegaphone.std.ts';

function getMegaphonesState(state: Readonly<StateType>): MegaphonesStateType {
  return state.megaphones;
}

const getVisibleMegaphones: StateSelector<
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
