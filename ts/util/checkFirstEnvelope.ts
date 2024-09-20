// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNumber } from 'lodash';

import * as log from '../logging/log';
import { SignalService as Proto } from '../protobuf';
import { ToastType } from '../types/Toast';
import { HOUR, SECOND } from './durations';
import { isOlderThan } from './timestamp';
import { isProduction } from './version';

import type { IncomingWebSocketRequest } from '../textsecure/WebsocketResources';

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
    log.warn('checkFirstEnvelope: body was not present!');
    return;
  }

  const decoded = Proto.Envelope.decode(plaintext);
  const newEnvelopeTimestamp = decoded.timestamp?.toNumber();
  if (!isNumber(newEnvelopeTimestamp)) {
    log.warn('checkFirstEnvelope: timestamp is not a number!');
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
    `checkFirstEnvelope: Timestamp ${newEnvelopeTimestamp} has been seen ${newCount} times since ${kickoffTimestamp}`
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
  log.info(
    `checkFirstEnvelope: Is redux initialized? ${result ? 'Yes' : 'No'}`
  );
  return result;
}

function showToast() {
  log.info('checkFirstEnvelope: Showing toast asking user to submit logs');
  window.reduxActions.toast.showToast({
    toastType: ToastType.MessageLoop,
  });
}
