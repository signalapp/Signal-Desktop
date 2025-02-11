// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallingMessage } from '@signalapp/ringrtc';
import { CallMessageUrgency } from '@signalapp/ringrtc';
import Long from 'long';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { missingCaseError } from './missingCaseError';

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
      data: bufferToProto(opaque.data),
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
          opaque: bufferToProto(offer.opaque),
        }
      : undefined,
    answer: answer
      ? {
          ...answer,
          id: Long.fromValue(answer.callId),
          opaque: bufferToProto(answer.opaque),
        }
      : undefined,
    iceUpdate: iceCandidates
      ? iceCandidates.map((candidate): Proto.CallMessage.IIceUpdate => {
          return {
            ...candidate,
            id: Long.fromValue(candidate.callId),
            opaque: bufferToProto(candidate.opaque),
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

function bufferToProto(
  value: Buffer | { toArrayBuffer(): ArrayBuffer } | undefined
): Uint8Array | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Uint8Array) {
    return value;
  }

  return new Uint8Array(value.toArrayBuffer());
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
      log.error(missingCaseError(urgency));
      return Proto.CallMessage.Opaque.Urgency.DROPPABLE;
  }
}
