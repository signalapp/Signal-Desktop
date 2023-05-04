// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clone, has } from 'lodash';
import { contextBridge } from 'electron';

import * as log from '../../logging/log';

import './phase1-ipc';
import '../preload';
import './phase2-dependencies';
import './phase3-post-signal';
import './phase4-test';
import '../../backbone/reliable_trigger';

import type { FeatureFlagType } from '../../window.d';
import type { StorageAccessType } from '../../types/Storage.d';
import type { CdsLookupOptionsType } from '../../textsecure/WebAPI';
import { start as startConversationController } from '../../ConversationController';
import { MessageController } from '../../util/MessageController';
import { Environment, getEnvironment } from '../../environment';
import { isProduction } from '../../util/version';
import { ipcInvoke } from '../../sql/channels';

window.addEventListener('contextmenu', e => {
  const node = e.target as Element | null;

  const isEditable = Boolean(
    node?.closest('textarea, input, [contenteditable="true"]')
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

window.Whisper.events = clone(window.Backbone.Events);
MessageController.install();
startConversationController();

if (!isProduction(window.SignalContext.getVersion())) {
  const SignalDebug = {
    cdsLookup: (options: CdsLookupOptionsType) =>
      window.textsecure.server?.cdsLookup(options),
    getConversation: (id: string) => window.ConversationController.get(id),
    getMessageById: (id: string) => window.MessageController.getById(id),
    getReduxState: () => window.reduxStore.getState(),
    getSfuUrl: () => window.Signal.Services.calling._sfuUrl,
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
    sqlCall: (name: string, ...args: ReadonlyArray<unknown>) =>
      ipcInvoke(name, args),
  };

  contextBridge.exposeInMainWorld('SignalDebug', SignalDebug);
}

if (getEnvironment() === Environment.Test) {
  contextBridge.exposeInMainWorld('RETRY_DELAY', window.RETRY_DELAY);
  contextBridge.exposeInMainWorld('assert', window.assert);
  contextBridge.exposeInMainWorld('testUtilities', window.testUtilities);
}

if (process.env.SIGNAL_CI_CONFIG) {
  contextBridge.exposeInMainWorld('SignalCI', window.SignalCI);
}

contextBridge.exposeInMainWorld('showDebugLog', window.IPC.showDebugLog);
contextBridge.exposeInMainWorld('startApp', window.startApp);
