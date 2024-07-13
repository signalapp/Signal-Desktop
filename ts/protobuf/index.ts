// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import './wrap';

import {
  signal as Signal,
  signalbackups as Backups,
  signalservice as SignalService,
} from './compiled';

export { Backups, SignalService, Signal };
