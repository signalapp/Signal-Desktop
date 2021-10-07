// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';

import { SignalContext } from '../context';

contextBridge.exposeInMainWorld('SignalContext', SignalContext);
