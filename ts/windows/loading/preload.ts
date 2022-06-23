// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../shims';

import { contextBridge } from 'electron';

import { SignalContext } from '../context';

contextBridge.exposeInMainWorld('SignalContext', SignalContext);
