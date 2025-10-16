// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  callLinkToRecord,
  callLinkFromRecord,
} from '../../util/callLinksRingrtc.node.js';
import {
  FAKE_CALL_LINK as CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY as CALL_LINK_WITH_ADMIN_KEY,
  FAKE_CALL_LINK_WITH_EPOCH as CALL_LINK_WITH_EPOCH,
  FAKE_CALL_LINK_WITH_ADMIN_KEY_AND_EPOCH as CALL_LINK_WITH_ADMIN_KEY_AND_EPOCH,
} from '../../test-helpers/fakeCallLink.std.js';

describe('callLinks', () => {
  it('callLinkToRecord() and callLinkFromRecord() can convert to record and back', () => {
    [
      CALL_LINK,
      CALL_LINK_WITH_ADMIN_KEY,
      CALL_LINK_WITH_EPOCH,
      CALL_LINK_WITH_ADMIN_KEY_AND_EPOCH,
    ].forEach(callLink => {
      const record = callLinkToRecord(callLink);
      const returnedCallLink = callLinkFromRecord(record);
      assert.deepEqual(returnedCallLink, callLink);
    });
  });
});
