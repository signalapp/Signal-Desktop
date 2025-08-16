// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { CallId } from '@signalapp/ringrtc';
import {
  CallMessageUrgency,
  CallingMessage,
  HangupMessage,
  HangupType,
  OpaqueMessage,
} from '@signalapp/ringrtc';
import { SignalService as Proto } from '../../protobuf';

import { callingMessageToProto } from '../../util/callingMessageToProto';

describe('callingMessageToProto', () => {
  // NOTE: These tests are incomplete.

  describe('hangup field', () => {
    it('leaves the field unset if `hangup` is not provided', () => {
      const result = callingMessageToProto(new CallingMessage());
      assert.isUndefined(result.hangup);
    });

    it('attaches the type if provided', () => {
      const callId: CallId = { high: 0, low: 0, unsigned: false };

      const callingMessage = new CallingMessage();
      callingMessage.hangup = new HangupMessage(callId, HangupType.Busy, 1);

      const result = callingMessageToProto(callingMessage);

      assert.strictEqual(result.hangup?.type, 3);
    });
  });

  describe('opaque field', () => {
    it('leaves the field unset if neither `opaque` nor urgency are provided', () => {
      const result = callingMessageToProto(new CallingMessage());
      assert.isUndefined(result.opaque);
    });

    it('attaches opaque data', () => {
      const callingMessage = new CallingMessage();
      callingMessage.opaque = new OpaqueMessage();
      callingMessage.opaque.data = Buffer.from([1, 2, 3]);

      const result = callingMessageToProto(callingMessage);

      assert.deepEqual(result.opaque?.data, new Uint8Array([1, 2, 3]));
    });

    it('attaches urgency if provided', () => {
      const droppableResult = callingMessageToProto(
        new CallingMessage(),
        CallMessageUrgency.Droppable
      );
      assert.deepEqual(
        droppableResult.opaque?.urgency,
        Proto.CallMessage.Opaque.Urgency.DROPPABLE
      );

      const urgentResult = callingMessageToProto(
        new CallingMessage(),
        CallMessageUrgency.HandleImmediately
      );
      assert.deepEqual(
        urgentResult.opaque?.urgency,
        Proto.CallMessage.Opaque.Urgency.HANDLE_IMMEDIATELY
      );
    });

    it('attaches urgency and opaque data if both are provided', () => {
      const callingMessage = new CallingMessage();
      callingMessage.opaque = new OpaqueMessage();
      callingMessage.opaque.data = Buffer.from([1, 2, 3]);

      const result = callingMessageToProto(
        callingMessage,
        CallMessageUrgency.HandleImmediately
      );

      assert.deepEqual(result.opaque?.data, new Uint8Array([1, 2, 3]));
      assert.deepEqual(
        result.opaque?.urgency,
        Proto.CallMessage.Opaque.Urgency.HANDLE_IMMEDIATELY
      );
    });
  });
});
