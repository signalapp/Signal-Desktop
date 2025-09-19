// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EventTarget from './EventTarget.js';
import AccountManager from './AccountManager.js';
import MessageReceiver from './MessageReceiver.js';
import utils from './Helpers.js';
import MessageSender from './SendMessage.js';
import { Storage } from './Storage.js';
import * as WebAPI from './WebAPI.js';
import WebSocketResource from './WebsocketResources.js';

export type TextSecureType = {
  utils: typeof utils;
  storage: Storage;

  AccountManager: typeof AccountManager;
  EventTarget: typeof EventTarget;
  MessageReceiver: typeof MessageReceiver;
  MessageSender: typeof MessageSender;
  WebAPI: typeof WebAPI;
  WebSocketResource: typeof WebSocketResource;

  server?: WebAPI.WebAPIType;
  messaging?: MessageSender;
};

export const textsecure: TextSecureType = {
  utils,
  storage: new Storage(),

  AccountManager,
  EventTarget,
  MessageReceiver,
  MessageSender,
  WebAPI,
  WebSocketResource,
};
