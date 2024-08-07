// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  callLinkToRecord,
  callLinkFromRecord,
} from '../../util/callLinksRingrtc';
import {
  FAKE_CALL_LINK as CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY as CALL_LINK_WITH_ADMIN_KEY,
} from '../helpers/fakeCallLink';

describe('callLinks', () => {
  it('callLinkToRecord() and callLinkFromRecord() can convert to record and back', () => {
    [CALL_LINK, CALL_LINK_WITH_ADMIN_KEY].forEach(callLink => {
      const record = callLinkToRecord(callLink);
      const returnedCallLink = callLinkFromRecord(record);
      assert.deepEqual(returnedCallLink, callLink);
    });
  });
});
