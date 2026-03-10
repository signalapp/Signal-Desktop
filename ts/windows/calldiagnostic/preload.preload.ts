// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge, ipcRenderer } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.js';

// External store for useSyncExternalStore
let currentData: string | null = null;
const listeners = new Set<() => void>();

async function fetchData(): Promise<void> {
  currentData = await ipcRenderer.invoke('get-call-diagnostic-data');
  listeners.forEach(listener => listener());
}

ipcRenderer.on('call-diagnostic-data-updated', () => {
  void fetchData();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return currentData;
}

void fetchData();

const Signal = {
  CallDiagnosticWindowProps: {
    subscribe,
    getSnapshot,
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
