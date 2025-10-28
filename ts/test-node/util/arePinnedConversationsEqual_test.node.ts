// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { arePinnedConversationsEqual } from '../../util/arePinnedConversationsEqual.node.js';
import { SignalService as Proto } from '../../protobuf/index.std.js';

import PinnedConversation = Proto.AccountRecord.IPinnedConversation;

describe('arePinnedConversationsEqual', () => {
  it('is equal if both have same values at same indices', () => {
    const localValue = [
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
      {
        groupMasterKey: new Uint8Array(32),
      },
    ];
    const remoteValue = [
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
      {
        groupMasterKey: new Uint8Array(32),
      },
    ];

    assert.isTrue(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if values are mixed', () => {
    const localValue = [
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
      {
        contact: {
          serviceId: 'f59a9fed-9e91-4bb4-a015-d49e58b47e25',
          e164: '+17865554321',
        },
      },
    ];
    const remoteValue = [
      {
        contact: {
          serviceId: 'f59a9fed-9e91-4bb4-a015-d49e58b47e25',
          e164: '+17865554321',
        },
      },
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
    ];

    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if lengths are not same', () => {
    const localValue = [
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
    ];
    const remoteValue: Array<PinnedConversation> = [];
    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if content does not match', () => {
    const localValue = [
      {
        contact: {
          serviceId: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
      },
    ];
    const remoteValue = [
      {
        groupMasterKey: new Uint8Array(32),
      },
    ];
    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });
});
