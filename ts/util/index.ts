// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as GoogleChrome from './GoogleChrome';
import * as Registration from './registration';
import { arrayBufferToObjectURL } from './arrayBufferToObjectURL';
import { combineNames } from './combineNames';
import { createBatcher } from './batcher';
import { createWaitBatcher } from './waitBatcher';
import { deleteForEveryone } from './deleteForEveryone';
import { downloadAttachment } from './downloadAttachment';
import { generateSecurityNumber } from './safetyNumber';
import { getStringForProfileChange } from './getStringForProfileChange';
import { getTextWithMentions } from './getTextWithMentions';
import { getUserAgent } from './getUserAgent';
import { hasExpired } from './hasExpired';
import {
  initializeMessageCounter,
  incrementMessageCounter,
  flushMessageCounter,
} from './incrementMessageCounter';
import { isFileDangerous } from './isFileDangerous';
import { makeLookup } from './makeLookup';
import {
  queueUpdateMessage,
  saveNewMessageBatcher,
  setBatchingStrategy,
} from './messageBatcher';
import { missingCaseError } from './missingCaseError';
import { parseRemoteClientExpiration } from './parseRemoteClientExpiration';
import { sleep } from './sleep';
import { longRunningTaskWrapper } from './longRunningTaskWrapper';
import { toWebSafeBase64, fromWebSafeBase64 } from './webSafeBase64';
import { mapToSupportLocale } from './mapToSupportLocale';
import {
  sessionRecordToProtobuf,
  sessionStructureToBytes,
} from './sessionTranslation';
import * as zkgroup from './zkgroup';
import { StartupQueue } from './StartupQueue';
import { sendToGroup, sendContentMessageToGroup } from './sendToGroup';
import { RetryPlaceholders } from './retryPlaceholders';
import * as expirationTimer from './expirationTimer';
import { MessageController } from './MessageController';

export {
  GoogleChrome,
  Registration,
  StartupQueue,
  arrayBufferToObjectURL,
  combineNames,
  createBatcher,
  createWaitBatcher,
  deleteForEveryone,
  downloadAttachment,
  flushMessageCounter,
  fromWebSafeBase64,
  generateSecurityNumber,
  getStringForProfileChange,
  getTextWithMentions,
  getUserAgent,
  hasExpired,
  incrementMessageCounter,
  initializeMessageCounter,
  isFileDangerous,
  longRunningTaskWrapper,
  makeLookup,
  mapToSupportLocale,
  MessageController,
  missingCaseError,
  parseRemoteClientExpiration,
  queueUpdateMessage,
  RetryPlaceholders,
  saveNewMessageBatcher,
  sendContentMessageToGroup,
  sendToGroup,
  setBatchingStrategy,
  sessionRecordToProtobuf,
  sessionStructureToBytes,
  sleep,
  toWebSafeBase64,
  zkgroup,
  expirationTimer,
};
