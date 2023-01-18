// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { clone } from 'lodash';
import { contextBridge } from 'electron';

import * as log from '../../logging/log';
import { SignalContext } from '../context';

import './phase1-ipc';
import '../preload';
import './phase2-dependencies';
import './phase3-post-signal';
import './phase4-test';
import '../../backbone/reliable_trigger';

import { WebAudioRecorder } from '../../WebAudioRecorder';
import { getSignalProtocolStore } from '../../SignalProtocolStore';
import { start as startConversationController } from '../../ConversationController';
import { MessageController } from '../../util/MessageController';

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

const isTestElectron = process.env.TEST_QUIT_ON_COMPLETE;

window.Whisper.events = clone(window.Backbone.Events);
MessageController.install();
startConversationController();

if (isTestElectron) {
  window.getSignalProtocolStore = getSignalProtocolStore;
} else {
  contextBridge.exposeInMainWorld('SignalContext', SignalContext);

  contextBridge.exposeInMainWorld('Backbone', window.Backbone);

  contextBridge.exposeInMainWorld('BasePaths', window.BasePaths);
  contextBridge.exposeInMainWorld(
    'ConversationController',
    window.ConversationController
  );
  contextBridge.exposeInMainWorld('Events', window.Events);
  contextBridge.exposeInMainWorld('Flags', window.Flags);
  contextBridge.exposeInMainWorld('IPC', window.IPC);
  contextBridge.exposeInMainWorld(
    'SignalProtocolStore',
    window.SignalProtocolStore
  );
  contextBridge.exposeInMainWorld(
    'getSignalProtocolStore',
    getSignalProtocolStore
  );
  contextBridge.exposeInMainWorld(
    'MessageController',
    window.MessageController
  );
  contextBridge.exposeInMainWorld('WebAudioRecorder', WebAudioRecorder);
  contextBridge.exposeInMainWorld('WebAPI', window.WebAPI);
  contextBridge.exposeInMainWorld('Whisper', window.Whisper);
  contextBridge.exposeInMainWorld('i18n', window.i18n);
  contextBridge.exposeInMainWorld('reduxActions', window.reduxActions);
  contextBridge.exposeInMainWorld('reduxStore', window.reduxStore);
  contextBridge.exposeInMainWorld('startApp', window.startApp);
  contextBridge.exposeInMainWorld('textsecure', window.textsecure);

  // TODO DESKTOP-4801
  contextBridge.exposeInMainWorld('ROOT_PATH', window.ROOT_PATH);
  contextBridge.exposeInMainWorld('Signal', window.Signal);
  contextBridge.exposeInMainWorld(
    'enterKeyboardMode',
    window.enterKeyboardMode
  );
  contextBridge.exposeInMainWorld('enterMouseMode', window.enterMouseMode);
  contextBridge.exposeInMainWorld(
    'getAccountManager',
    window.getAccountManager
  );
  contextBridge.exposeInMainWorld('getAppInstance', window.getAppInstance);
  contextBridge.exposeInMainWorld('getBuildCreation', window.getBuildCreation);
  contextBridge.exposeInMainWorld(
    'getBuildExpiration',
    window.getBuildExpiration
  );
  contextBridge.exposeInMainWorld('getConversations', window.getConversations);
  contextBridge.exposeInMainWorld('getEnvironment', window.getEnvironment);
  contextBridge.exposeInMainWorld('getHostName', window.getHostName);
  contextBridge.exposeInMainWorld(
    'getInteractionMode',
    window.getInteractionMode
  );
  contextBridge.exposeInMainWorld('getLocale', window.getLocale);
  contextBridge.exposeInMainWorld(
    'getServerPublicParams',
    window.getServerPublicParams
  );
  contextBridge.exposeInMainWorld(
    'getServerTrustRoot',
    window.getServerTrustRoot
  );
  contextBridge.exposeInMainWorld('getSfuUrl', window.getSfuUrl);
  contextBridge.exposeInMainWorld('getSocketStatus', window.getSocketStatus);
  contextBridge.exposeInMainWorld('getSyncRequest', window.getSyncRequest);
  contextBridge.exposeInMainWorld('getTitle', window.getTitle);
  contextBridge.exposeInMainWorld('getVersion', window.getVersion);
  contextBridge.exposeInMainWorld('initialTheme', window.initialTheme);
  contextBridge.exposeInMainWorld('isAfterVersion', window.isAfterVersion);
  contextBridge.exposeInMainWorld('isBeforeVersion', window.isBeforeVersion);
  contextBridge.exposeInMainWorld('isBehindProxy', window.isBehindProxy);
  contextBridge.exposeInMainWorld(
    'libphonenumberFormat',
    window.libphonenumberFormat
  );
  contextBridge.exposeInMainWorld(
    'libphonenumberInstance',
    window.libphonenumberInstance
  );
  contextBridge.exposeInMainWorld('localeMessages', window.localeMessages);
  contextBridge.exposeInMainWorld(
    'logAuthenticatedConnect',
    window.logAuthenticatedConnect
  );
  contextBridge.exposeInMainWorld('nodeSetImmediate', window.nodeSetImmediate);
  contextBridge.exposeInMainWorld('platform', window.platform);
  contextBridge.exposeInMainWorld('preloadedImages', window.preloadedImages);
  contextBridge.exposeInMainWorld(
    'sendChallengeRequest',
    window.sendChallengeRequest
  );
  contextBridge.exposeInMainWorld('setImmediate', window.setImmediate);
  contextBridge.exposeInMainWorld(
    'showKeyboardShortcuts',
    window.showKeyboardShortcuts
  );
  contextBridge.exposeInMainWorld('storage', window.storage);
  contextBridge.exposeInMainWorld('systemTheme', window.systemTheme);
  contextBridge.exposeInMainWorld(
    'waitForEmptyEventQueue',
    window.waitForEmptyEventQueue
  );

  contextBridge.exposeInMainWorld('assert', window.assert);
  contextBridge.exposeInMainWorld('RETRY_DELAY', window.RETRY_DELAY);
  contextBridge.exposeInMainWorld('testUtilities', window.testUtilities);
}
