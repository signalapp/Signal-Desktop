// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { UnidentifiedSenderMessageContent } from '@signalapp/libsignal-client';

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
  receivedAtCounter: number | null;
  timestamp: number;
  serverGuid?: string;
  serverTimestamp?: number;
  source?: string;
  sourceDevice?: number;
  sourceUuid?: string;
  destinationUuid?: string;
  messageAgeSec?: number;
  version: number;
};

export { StorageServiceCallOptionsType, StorageServiceCredentials };

export type TextSecureType = {
  storage: Storage;
  server: WebAPIType;
  messageSender: MessageSender;
  messaging: SendMessage;
  utils: typeof utils;

  EventTarget: typeof EventTarget;
  AccountManager: WhatIsThis;
  MessageSender: typeof MessageSender;
  SyncRequest: typeof SyncRequest;
};
