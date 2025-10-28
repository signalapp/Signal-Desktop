// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StateType } from '../reducer.preload.js';
import type { InstallerStateType } from '../ducks/installer.preload.js';

export const getInstallerState = (state: StateType): InstallerStateType =>
  state.installer;
