// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';

// It is important to call this as early as possible
import '../context';

import { SignalWindow } from '../configure';

contextBridge.exposeInMainWorld('SignalWindow', SignalWindow);
