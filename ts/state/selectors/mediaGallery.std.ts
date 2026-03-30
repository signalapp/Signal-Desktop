// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StateType } from '../reducer.preload.ts';
import type { MediaGalleryStateType } from '../ducks/mediaGallery.preload.ts';

export const getMediaGalleryState = (state: StateType): MediaGalleryStateType =>
  state.mediaGallery;
