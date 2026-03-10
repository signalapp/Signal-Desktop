// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallingMessage } from '@signalapp/ringrtc';
import { CallMessageUrgency } from '@signalapp/ringrtc';
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
): Proto.CallMessage.Params {
  let opaqueField: undefined | Proto.CallMessage.Opaque.Params;
  if (opaque) {
    opaqueField = {
      ...opaque,
      urgency: null,
      data: opaque.data ?? null,
    };
  }
  if (urgency !== undefined) {
    opaqueField = {
      ...(opaqueField ?? { data: null, urgency: null }),
      urgency: urgencyToProto(urgency),
    };
  }

  return {
    offer: offer
      ? {
          ...offer,
          id: offer.callId,
          type: offer.type as number,
          opaque: offer.opaque,
        }
      : null,
    answer: answer
      ? {
          ...answer,
          id: answer.callId,
          opaque: answer.opaque,
        }
      : null,
    iceUpdate: iceCandidates
      ? iceCandidates.map((candidate): Proto.CallMessage.IceUpdate.Params => {
          return {
            ...candidate,
            id: candidate.callId,
            opaque: candidate.opaque,
          };
        })
      : null,
    busy: busy
      ? {
          ...busy,
          id: busy.callId,
        }
      : null,
    hangup: hangup
      ? {
          ...hangup,
          id: hangup.callId,
          type: hangup.type as number,
        }
      : null,
    destinationDeviceId: destinationDeviceId ?? null,
    opaque: opaqueField ?? null,
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
