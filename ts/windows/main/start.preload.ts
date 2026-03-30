// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import lodash from 'lodash';
import { contextBridge } from 'electron';

import { createLogger } from '../../logging/log.std.ts';

import '../context.preload.ts';

// Connect websocket early
import '../../textsecure/preconnect.preload.ts';

import './phase0-devtools.node.ts';
import './phase1-ipc.preload.ts';
import '../preload.preload.ts';
import './phase2-dependencies.preload.ts';
import './phase3-post-signal.preload.ts';
import './phase4-test.preload.ts';

import type {
  CdsLookupOptionsType,
  GetIceServersResultType,
} from '../../textsecure/WebAPI.preload.ts';
import { cdsLookup, getSocketStatus } from '../../textsecure/WebAPI.preload.ts';
import type { FeatureFlagType } from '../../window.d.ts';
import type { StorageAccessType } from '../../types/Storage.d.ts';
import { calling } from '../../services/calling.preload.ts';
import { Environment, getEnvironment } from '../../environment.std.ts';
import { isProduction } from '../../util/version.std.ts';
import { benchmarkConversationOpen } from '../../CI/benchmarkConversationOpen.preload.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { IMAGE_PNG } from '../../types/MIME.std.ts';
import { getSelectedConversationId } from '../../state/selectors/nav.std.ts';

const { has } = lodash;

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

if (
  !isProduction(window.SignalContext.getVersion()) ||
  window.SignalContext.config.devTools
) {
  const SignalDebug = {
    cdsLookup: (options: CdsLookupOptionsType) => cdsLookup(options),
    getSelectedConversation: () => {
      const conversationId = getSelectedConversationId(
        window.reduxStore.getState()
      );
      return window.ConversationController.get(conversationId)?.attributes;
    },
    archiveSessionsForCurrentConversation: async () => {
      const conversationId = getSelectedConversationId(
        window.reduxStore.getState()
      );
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
    getSfuUrl: () => calling.sfuUrl,
    getIceServerOverride: () => calling._iceServerOverride,
    getSocketStatus: () => getSocketStatus(),
    getStorageItem: (name: keyof StorageAccessType) => itemStorage.get(name),
    putStorageItem: <K extends keyof StorageAccessType>(
      name: K,
      value: StorageAccessType[K]
    ) => itemStorage.put(name, value),
    setFlag: (name: keyof FeatureFlagType, value: boolean) => {
      if (!has(window.Flags, name)) {
        return;
      }
      window.Flags[name] = value;
    },
    setSfuUrl: async (url: string) => {
      await itemStorage.put('sfuUrl', url);
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

      calling._iceServerOverride = override;
    },
    sendViewOnceImageInSelectedConversation: async () => {
      const conversationId = getSelectedConversationId(
        window.reduxStore.getState()
      );
      const conversation = window.ConversationController.get(conversationId);
      if (!conversation) {
        throw new Error('No conversation selected');
      }

      const canvas = new fabric.StaticCanvas(null, {
        width: 100,
        height: 100,
        backgroundColor: '#3b82f6',
      });
      const dataURL = canvas.toDataURL({ format: 'png' });
      const [base64Data] = dataURL.split(',');
      const data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      await conversation.enqueueMessageForSend(
        {
          body: undefined,
          attachments: [
            {
              contentType: IMAGE_PNG,
              size: data.byteLength,
              data,
            },
          ],
          isViewOnce: true,
        },
        {}
      );

      log.info('Sent view-once test image');
    },
    ...(window.SignalContext.config.ciMode === 'benchmark'
      ? {
          benchmarkConversationOpen,
        }
      : {}),
  };

  if (getEnvironment() !== Environment.Test) {
    contextBridge.exposeInMainWorld('SignalDebug', SignalDebug);
  }
}

// See ts/logging/log.ts
if (
  getEnvironment() !== Environment.PackagedApp &&
  getEnvironment() !== Environment.Test
) {
  const debug = (...args: Array<string>) => {
    localStorage.setItem('debug', args.join(','));
  };
  contextBridge.exposeInMainWorld('debug', debug);
}

if (window.SignalContext.config.ciMode === 'full') {
  contextBridge.exposeInMainWorld('SignalCI', window.SignalCI);
}

if (getEnvironment() !== Environment.Test) {
  contextBridge.exposeInMainWorld('showDebugLog', window.IPC.showDebugLog);
  contextBridge.exposeInMainWorld('startApp', window.startApp);
}
