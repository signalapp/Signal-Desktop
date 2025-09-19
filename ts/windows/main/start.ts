// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { has } from 'lodash';
import { contextBridge } from 'electron';

import { createLogger } from '../../logging/log.js';

import '../context.js';

// Connect websocket early
import '../../textsecure/preconnect.js';

import './phase0-devtools.js';
import './phase1-ipc.js';
import '../preload.js';
import './phase2-dependencies.js';
import './phase3-post-signal.js';
import './phase4-test.js';

import type {
  CdsLookupOptionsType,
  GetIceServersResultType,
} from '../../textsecure/WebAPI.js';
import type { FeatureFlagType } from '../../window.d.ts';
import type { StorageAccessType } from '../../types/Storage.d.ts';
import { initMessageCleanup } from '../../services/messageStateCleanup.js';
import { Environment, getEnvironment } from '../../environment.js';
import { isProduction } from '../../util/version.js';
import { benchmarkConversationOpen } from '../../CI/benchmarkConversationOpen.js';

const log = createLogger('start');

window.addEventListener('contextmenu', e => {
  const node = e.target as Element | null;

  const isEditable = Boolean(
    node?.closest('textarea, input, [contenteditable="plaintext-only"]')
  );
  const isLink = Boolean(node?.closest('a'));
  const isImage = Boolean(node?.closest('.Lightbox img'));
  const hasSelection = Boolean(window.getSelection()?.toString());

  if (!isEditable && !hasSelection && !isLink && !isImage) {
    e.preventDefault();
  }
});

if (window.SignalContext.config.proxyUrl) {
  log.info('Using provided proxy url');
}

initMessageCleanup();

if (
  !isProduction(window.SignalContext.getVersion()) ||
  window.SignalContext.config.devTools
) {
  const SignalDebug = {
    cdsLookup: (options: CdsLookupOptionsType) =>
      window.textsecure.server?.cdsLookup(options),
    getSelectedConversation: () => {
      const conversationId =
        window.reduxStore.getState().conversations.selectedConversationId;
      return window.ConversationController.get(conversationId)?.attributes;
    },
    archiveSessionsForCurrentConversation: async () => {
      const conversationId =
        window.reduxStore.getState().conversations.selectedConversationId;
      await window.ConversationController.archiveSessionsForConversation(
        conversationId
      );
    },
    getConversation: (id: string) => window.ConversationController.get(id),
    getMessageById: (id: string) => window.MessageCache.getById(id)?.attributes,
    getMessageBySentAt: async (timestamp: number) => {
      const message = await window.MessageCache.findBySentAt(
        timestamp,
        () => true
      );
      return message?.attributes;
    },
    getReduxState: () => window.reduxStore.getState(),
    getSfuUrl: () => window.Signal.Services.calling._sfuUrl,
    getIceServerOverride: () =>
      window.Signal.Services.calling._iceServerOverride,
    getSocketStatus: () => window.textsecure.server?.getSocketStatus(),
    getStorageItem: (name: keyof StorageAccessType) => window.storage.get(name),
    putStorageItem: <K extends keyof StorageAccessType>(
      name: K,
      value: StorageAccessType[K]
    ) => window.storage.put(name, value),
    setFlag: (name: keyof FeatureFlagType, value: boolean) => {
      if (!has(window.Flags, name)) {
        return;
      }
      window.Flags[name] = value;
    },
    setSfuUrl: (url: string) => {
      window.Signal.Services.calling._sfuUrl = url;
    },
    setIceServerOverride: (
      override: GetIceServersResultType | string | undefined
    ) => {
      if (typeof override === 'string') {
        if (!/(turn|turns|stun):.*/.test(override)) {
          log.warn(
            'Override url should be prefixed with `turn:`, `turns:`, or `stun:` else override may not work'
          );
        }
      }

      window.Signal.Services.calling._iceServerOverride = override;
    },
    setRtcStatsInterval: (intervalMillis: number) =>
      window.Signal.Services.calling.setAllRtcStatsInterval(intervalMillis),
    ...(window.SignalContext.config.ciMode === 'benchmark'
      ? {
          benchmarkConversationOpen,
        }
      : {}),
  };

  contextBridge.exposeInMainWorld('SignalDebug', SignalDebug);
}

if (getEnvironment() === Environment.Test) {
  contextBridge.exposeInMainWorld('RETRY_DELAY', window.RETRY_DELAY);
  contextBridge.exposeInMainWorld('assert', window.assert);
  contextBridge.exposeInMainWorld('testUtilities', window.testUtilities);
}

// See ts/logging/log.ts
if (getEnvironment() !== Environment.PackagedApp) {
  const debug = (...args: Array<string>) => {
    localStorage.setItem('debug', args.join(','));
  };
  contextBridge.exposeInMainWorld('debug', debug);
}

if (window.SignalContext.config.ciMode === 'full') {
  contextBridge.exposeInMainWorld('SignalCI', window.SignalCI);
}

contextBridge.exposeInMainWorld('showDebugLog', window.IPC.showDebugLog);
contextBridge.exposeInMainWorld('startApp', window.startApp);
