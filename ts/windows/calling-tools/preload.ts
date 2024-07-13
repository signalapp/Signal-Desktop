// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import type { Event } from 'electron/renderer';
import { MinimalSignalContext } from '../minimalContext';

type RtcStatsReport = {
  conversationId: string;
  callId: string;
  reportJson: string;
};

const Signal = {
  CallingToolsProps: {
    onRtcStatsReport: (
      callback: (event: Event, value: RtcStatsReport) => void
    ) => ipcRenderer.on('calling:rtc-stats-report', callback),
    setRtcStatsInterval: (intervalMillis: number) => {
      ipcRenderer.send('calling:set-rtc-stats-interval', intervalMillis);
    },
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
