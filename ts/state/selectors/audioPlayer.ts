// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StateType } from '../reducer';

export const isPaused = (state: StateType): boolean => {
  return state.audioPlayer.activeAudioID === undefined;
};
