// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StateType } from '../reducer';
import type { MediaGalleryStateType } from '../ducks/mediaGallery';

export const getMediaGalleryState = (state: StateType): MediaGalleryStateType =>
  state.mediaGallery;
