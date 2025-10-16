// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallingMessage } from '@signalapp/ringrtc';
import { CallMessageUrgency } from '@signalapp/ringrtc';
import Long from 'long';
import { SignalService as Proto } from '../protobuf/index.std.js';
import { createLogger } from '../logging/log.std.js';
import { toLogFormat } from '../types/errors.std.js';
import { missingCaseError } from './missingCaseError.std.js';

const log = createLogger('callingMessageToProto');

export function callingMessageToProto(
  {
    offer,
    answer,
    iceCandidates,
    busy,
    hangup,
    destinationDeviceId,
    opaque,
  }: CallingMessage,
  urgency?: CallMessageUrgency
): Proto.ICallMessage {
  let opaqueField: undefined | Proto.CallMessage.IOpaque;
  if (opaque) {
    opaqueField = {
      ...opaque,
      data: opaque.data,
    };
  }
  if (urgency !== undefined) {
    opaqueField = {
      ...(opaqueField ?? {}),
      urgency: urgencyToProto(urgency),
    };
  }

  return {
    offer: offer
      ? {
          ...offer,
          id: Long.fromValue(offer.callId),
          type: offer.type as number,
          opaque: offer.opaque,
        }
      : undefined,
    answer: answer
      ? {
          ...answer,
          id: Long.fromValue(answer.callId),
          opaque: answer.opaque,
        }
      : undefined,
    iceUpdate: iceCandidates
      ? iceCandidates.map((candidate): Proto.CallMessage.IIceUpdate => {
          return {
            ...candidate,
            id: Long.fromValue(candidate.callId),
            opaque: candidate.opaque,
          };
        })
      : undefined,
    busy: busy
      ? {
          ...busy,
          id: Long.fromValue(busy.callId),
        }
      : undefined,
    hangup: hangup
      ? {
          ...hangup,
          id: Long.fromValue(hangup.callId),
          type: hangup.type as number,
        }
      : undefined,
    destinationDeviceId,
    opaque: opaqueField,
  };
}

function urgencyToProto(
  urgency: CallMessageUrgency
): Proto.CallMessage.Opaque.Urgency {
  switch (urgency) {
    case CallMessageUrgency.Droppable:
      return Proto.CallMessage.Opaque.Urgency.DROPPABLE;
    case CallMessageUrgency.HandleImmediately:
      return Proto.CallMessage.Opaque.Urgency.HANDLE_IMMEDIATELY;
    default:
      log.error(toLogFormat(missingCaseError(urgency)));
      return Proto.CallMessage.Opaque.Urgency.DROPPABLE;
  }
}
