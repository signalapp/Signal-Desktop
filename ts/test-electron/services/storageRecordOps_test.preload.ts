// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { mergeContactRecord } from '../../services/storageRecordOps.preload.ts';
import { SIGNAL_ACI } from '../../types/SignalConversation.std.ts';
import { toAciObject } from '../../util/ServiceId.node.ts';

describe('storageRecordOps', () => {
  it('drops ContactRecords for the official Signal conversation', async () => {
    const contactRecord = Proto.ContactRecord.decode(
      Proto.ContactRecord.encode({
        aci: null,
        e164: null,
        pni: null,
        profileKey: null,
        identityKey: null,
        identityState: null,
        givenName: null,
        familyName: null,
        username: null,
        blocked: null,
        whitelisted: null,
        archived: null,
        markedUnread: null,
        mutedUntilTimestamp: null,
        hideStory: null,
        unregisteredAtTimestamp: null,
        systemGivenName: null,
        systemFamilyName: null,
        systemNickname: null,
        hidden: null,
        pniSignatureVerified: null,
        nickname: null,
        note: null,
        avatarColor: null,
        aciBinary: toAciObject(SIGNAL_ACI).getRawUuidBytes(),
        pniBinary: null,
      })
    );

    assert.deepEqual(await mergeContactRecord('storage-id', 1, contactRecord), {
      shouldDrop: true,
      details: ['official Signal conversation contact record'],
    });
  });
});
