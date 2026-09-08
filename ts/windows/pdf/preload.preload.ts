// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.ts';
import { PDFWindowPropsSchema } from './types.std.ts';

const Signal = {
  PDFWindowProps: PDFWindowPropsSchema.parse(
    ipcRenderer.sendSync('pdf:getProps')
  ),
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
