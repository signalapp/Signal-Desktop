// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { callLinkToRecord, callLinkFromRecord } from '../../util/callLinks';
import type { CallLinkType } from '../../types/CallLink';
import { CallLinkRestrictions } from '../../types/CallLink';
import { MONTH } from '../../util/durations/constants';

const CALL_LINK: CallLinkType = {
  adminKey: null,
  expiration: Date.now() + MONTH,
  name: 'Fun Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'c097eb04cc278d6bc7ed9fb2ddeac00dc9646ae6ddb38513dad9a8a4fe3c38f4',
  rootKey: 'bpmc-mrgn-hntf-mffd-mndd-xbxk-zmgq-qszg',
};

const CALL_LINK_WITH_ADMIN_KEY: CallLinkType = {
  adminKey: 'xXPI77e6MoVHYREW8iKYmQ==',
  expiration: Date.now() + MONTH,
  name: 'Fun Link',
  restrictions: CallLinkRestrictions.None,
  revoked: false,
  roomId: 'c097eb04cc278d6bc7ed9fb2ddeac00dc9646ae6ddb38513dad9a8a4fe3c38f4',
  rootKey: 'bpmc-mrgn-hntf-mffd-mndd-xbxk-zmgq-qszg',
};

describe('callLinks', () => {
  it('callLinkToRecord() and callLinkFromRecord() can convert to record and back', () => {
    [CALL_LINK, CALL_LINK_WITH_ADMIN_KEY].forEach(callLink => {
      const record = callLinkToRecord(callLink);
      const returnedCallLink = callLinkFromRecord(record);
      assert.deepEqual(returnedCallLink, callLink);
    });
  });
});
