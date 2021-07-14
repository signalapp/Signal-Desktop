// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UnidentifiedSenderMessageContent } from '@signalapp/signal-client';

import Crypto from './textsecure/Crypto';
import MessageReceiver from './textsecure/MessageReceiver';
import MessageSender from './textsecure/SendMessage';
import SyncRequest from './textsecure/SyncRequest';
import EventTarget from './textsecure/EventTarget';
import SendMessage, { SendOptionsType } from './textsecure/SendMessage';
import { WebAPIType } from './textsecure/WebAPI';
import utils from './textsecure/Helpers';
import { CallingMessage as CallingMessageClass } from 'ringrtc';
import { WhatIsThis } from './window.d';
import { Storage } from './textsecure/Storage';
import {
  StorageServiceCallOptionsType,
  StorageServiceCredentials,
  ProcessedAttachment,
} from './textsecure/Types.d';

export type UnprocessedType = {
  attempts: number;
  decrypted?: string;
  envelope?: string;
  id: string;
  timestamp: number;
  serverGuid?: string;
  serverTimestamp?: number;
  source?: string;
  sourceDevice?: number;
  sourceUuid?: string;
  messageAgeSec?: number;
  version: number;
};

export { StorageServiceCallOptionsType, StorageServiceCredentials };

export type TextSecureType = {
  createTaskWithTimeout: (
    task: () => Promise<any> | any,
    id?: string,
    options?: { timeout?: number }
  ) => () => Promise<any>;
  crypto: typeof Crypto;
  storage: Storage;
  messageReceiver: MessageReceiver;
  messageSender: MessageSender;
  messaging: SendMessage;
  utils: typeof utils;

  EventTarget: typeof EventTarget;
  MessageReceiver: typeof MessageReceiver;
  AccountManager: WhatIsThis;
  MessageSender: typeof MessageSender;
  SyncRequest: typeof SyncRequest;
};
