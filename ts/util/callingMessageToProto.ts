// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallingMessage } from 'ringrtc';
import { CallMessageUrgency } from 'ringrtc';
import { SignalService as Proto } from '../protobuf';
import * as log from '../logging/log';
import { missingCaseError } from './missingCaseError';

export function callingMessageToProto(
  {
    offer,
    answer,
    iceCandidates,
    legacyHangup,
    busy,
    hangup,
    supportsMultiRing,
    destinationDeviceId,
    opaque,
  }: CallingMessage,
  urgency?: CallMessageUrgency
): Proto.ICallingMessage {
  let opaqueField: undefined | Proto.CallingMessage.IOpaque;
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
          type: offer.type as number,
          opaque: bufferToProto(offer.opaque),
        }
      : undefined,
    answer: answer
      ? {
          ...answer,
          opaque: bufferToProto(answer.opaque),
        }
      : undefined,
    iceCandidates: iceCandidates
      ? iceCandidates.map(candidate => {
          return {
            ...candidate,
            opaque: bufferToProto(candidate.opaque),
          };
        })
      : undefined,
    legacyHangup: legacyHangup
      ? {
          ...legacyHangup,
          type: legacyHangup.type as number,
        }
      : undefined,
    busy,
    hangup: hangup
      ? {
          ...hangup,
          type: hangup.type as number,
        }
      : undefined,
    supportsMultiRing,
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
): Proto.CallingMessage.Opaque.Urgency {
  switch (urgency) {
    case CallMessageUrgency.Droppable:
      return Proto.CallingMessage.Opaque.Urgency.DROPPABLE;
    case CallMessageUrgency.HandleImmediately:
      return Proto.CallingMessage.Opaque.Urgency.HANDLE_IMMEDIATELY;
    default:
      log.error(missingCaseError(urgency));
      return Proto.CallingMessage.Opaque.Urgency.DROPPABLE;
  }
}
