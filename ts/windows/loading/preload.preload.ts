// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.ts';

contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
