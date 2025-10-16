// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { createLogger } from '../logging/log.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { ToastType } from '../types/Toast.dom.js';
import { HOUR, SECOND } from './durations/index.std.js';
import { isOlderThan } from './timestamp.std.js';
import { isProduction } from './version.std.js';

import type { IncomingWebSocketRequest } from '../textsecure/WebsocketResources.preload.js';

const { isNumber } = lodash;

const log = createLogger('checkFirstEnvelope');

const FIRST_ENVELOPE_COUNT = 5;
const FIRST_ENVELOPE_TIME = HOUR;
type FirstEnvelopeStats = {
  kickoffTimestamp: number;
  envelopeTimestamp: number;
  count: number;
};
let firstEnvelopeStats: FirstEnvelopeStats | undefined;

export function checkFirstEnvelope(incoming: IncomingWebSocketRequest): void {
  const { body: plaintext } = incoming;
  if (!plaintext) {
    log.warn('body was not present!');
    return;
  }

  const decoded = Proto.Envelope.decode(plaintext);
  const newEnvelopeTimestamp = decoded.clientTimestamp?.toNumber();
  if (!isNumber(newEnvelopeTimestamp)) {
    log.warn('timestamp is not a number!');
    return;
  }

  if (
    !firstEnvelopeStats ||
    firstEnvelopeStats.envelopeTimestamp !== newEnvelopeTimestamp ||
    isOlderThan(firstEnvelopeStats.kickoffTimestamp, FIRST_ENVELOPE_TIME)
  ) {
    firstEnvelopeStats = {
      kickoffTimestamp: Date.now(),
      envelopeTimestamp: newEnvelopeTimestamp,
      count: 1,
    };
    return;
  }

  const { count, kickoffTimestamp } = firstEnvelopeStats;
  const newCount = count + 1;

  if (newCount < FIRST_ENVELOPE_COUNT) {
    firstEnvelopeStats = {
      ...firstEnvelopeStats,
      count: newCount,
    };
    return;
  }

  log.warn(
    `Timestamp ${newEnvelopeTimestamp} has been seen ${newCount} times since ${kickoffTimestamp}`
  );
  if (isProduction(window.getVersion())) {
    return;
  }

  firstEnvelopeStats = undefined;

  if (isReduxInitialized()) {
    showToast();
  } else {
    const interval = setInterval(() => {
      if (isReduxInitialized()) {
        clearInterval(interval);
        showToast();
      }
    }, 5 * SECOND);
  }
}

function isReduxInitialized() {
  const result = Boolean(window.reduxActions);
  log.info(`Is redux initialized? ${result ? 'Yes' : 'No'}`);
  return result;
}

function showToast() {
  log.info('Showing toast asking user to submit logs');
  window.reduxActions.toast.showToast({
    toastType: ToastType.MessageLoop,
  });
}
