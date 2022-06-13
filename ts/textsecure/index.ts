// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EventTarget from './EventTarget';
import AccountManager from './AccountManager';
import MessageReceiver from './MessageReceiver';
import utils from './Helpers';
import { ContactBuffer, GroupBuffer } from './ContactsParser';
import SyncRequest from './SyncRequest';
import MessageSender from './SendMessage';
import { Storage } from './Storage';
import * as WebAPI from './WebAPI';
import WebSocketResource from './WebsocketResources';

export type TextSecureType = {
  utils: typeof utils;
  storage: Storage;

  AccountManager: typeof AccountManager;
  ContactBuffer: typeof ContactBuffer;
  EventTarget: typeof EventTarget;
  GroupBuffer: typeof GroupBuffer;
  MessageReceiver: typeof MessageReceiver;
  MessageSender: typeof MessageSender;
  SyncRequest: typeof SyncRequest;
  WebAPI: typeof WebAPI;
  WebSocketResource: typeof WebSocketResource;

  server?: WebAPI.WebAPIType;
  messaging?: MessageSender;
};

export const textsecure: TextSecureType = {
  utils,
  storage: new Storage(),

  AccountManager,
  ContactBuffer,
  EventTarget,
  GroupBuffer,
  MessageReceiver,
  MessageSender,
  SyncRequest,
  WebAPI,
  WebSocketResource,
};
