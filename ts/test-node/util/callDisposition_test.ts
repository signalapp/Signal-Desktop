// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { PeekInfo } from '@signalapp/ringrtc';
import { v4 as uuid } from 'uuid';
import {
  getPeerIdFromConversation,
  getCallIdFromEra,
  getGroupCallMeta,
} from '../../util/callDisposition';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-both/helpers/getDefaultConversation';
import { uuidToBytes } from '../../util/uuidToBytes';

const MOCK_ERA = 'abc';
const MOCK_CALL_ID = '16919744041952114874';

const MOCK_PEEK_INFO_BASE: PeekInfo = {
  devices: [],
  deviceCount: 0,
  deviceCountIncludingPendingDevices: 0,
  deviceCountExcludingPendingDevices: 0,
  pendingUsers: [],
};

describe('utils/callDisposition', () => {
  describe('getCallIdFromEra', () => {
    it('returns callId from era', () => {
      // just to ensure the mock is correct
      assert.strictEqual(getCallIdFromEra(MOCK_ERA), MOCK_CALL_ID);
    });
  });

  describe('getGroupCallMeta', () => {
    it('returns null if missing eraId or creator', () => {
      assert.isNull(getGroupCallMeta({ ...MOCK_PEEK_INFO_BASE }));
      assert.isNull(
        getGroupCallMeta({ ...MOCK_PEEK_INFO_BASE, eraId: MOCK_ERA })
      );
      assert.isNull(
        getGroupCallMeta({
          ...MOCK_PEEK_INFO_BASE,
          creator: Buffer.from(uuidToBytes(uuid())),
        })
      );
    });

    it('returns group call meta when all fields are provided', () => {
      const id = uuid();
      assert.deepStrictEqual(
        getGroupCallMeta({
          ...MOCK_PEEK_INFO_BASE,
          eraId: MOCK_ERA,
          creator: Buffer.from(uuidToBytes(id)),
        }),
        { callId: MOCK_CALL_ID, ringerId: id }
      );
    });
  });

  describe('getPeerIdFromConversation', () => {
    it('returns serviceId for direct conversation', () => {
      const conversation = getDefaultConversation();
      assert.strictEqual(
        getPeerIdFromConversation(conversation),
        conversation.serviceId
      );
    });
    it('returns groupId for group conversation', () => {
      const conversation = getDefaultGroup();
      assert.strictEqual(
        getPeerIdFromConversation(conversation),
        conversation.groupId
      );
    });
  });
});
