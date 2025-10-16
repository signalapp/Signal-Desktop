// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { RendererConfigType } from '../types/RendererConfig.std.js';

const config: RendererConfigType = ipcRenderer.sendSync('get-config');

export { config };
