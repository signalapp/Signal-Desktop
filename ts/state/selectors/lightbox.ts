// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { ReadonlyDeep } from 'type-fest';
import type { MediaItemType } from '../../types/MediaItem';
import type { StateType } from '../reducer';
import type { LightboxStateType } from '../ducks/lightbox';

export const getLightboxState = (state: StateType): LightboxStateType =>
  state.lightbox;

export const shouldShowLightbox = createSelector(
  getLightboxState,
  ({ isShowingLightbox }): boolean => isShowingLightbox
);

export const getIsViewOnce = createSelector(
  getLightboxState,
  (state): boolean => (state.isShowingLightbox ? state.isViewOnce : false)
);

export const getSelectedIndex = createSelector(
  getLightboxState,
  (state): number => {
    if (!state.isShowingLightbox) {
      return 0;
    }

    return state.selectedIndex ?? 0;
  }
);

export const getMedia = createSelector(
  getLightboxState,
  (state): ReadonlyArray<ReadonlyDeep<MediaItemType>> =>
    state.isShowingLightbox ? state.media : []
);

export const getHasPrevMessage = createSelector(
  getLightboxState,
  (state): boolean => state.isShowingLightbox && state.hasPrevMessage
);

export const getHasNextMessage = createSelector(
  getLightboxState,
  (state): boolean => state.isShowingLightbox && state.hasNextMessage
);

export const getPlaybackDisabled = createSelector(
  getLightboxState,
  (state): boolean => state.isShowingLightbox && state.playbackDisabled
);
