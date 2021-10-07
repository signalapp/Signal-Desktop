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

export const textsecure = {
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

export default textsecure;
