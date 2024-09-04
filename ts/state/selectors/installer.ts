// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StateType } from '../reducer';
import type { InstallerStateType } from '../ducks/installer';

export const getInstallerState = (state: StateType): InstallerStateType =>
  state.installer;
