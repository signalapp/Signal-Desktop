// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { arePinnedConversationsEqual } from '../../util/arePinnedConversationsEqual';
import { PinnedConversationClass } from '../../textsecure.d';

describe('arePinnedConversationsEqual', () => {
  it('is equal if both have same values at same indices', () => {
    const localValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
      {
        identifier: 'groupMasterKey' as const,
        groupMasterKey: new ArrayBuffer(32),
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];
    const remoteValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
      {
        identifier: 'groupMasterKey' as const,
        groupMasterKey: new ArrayBuffer(32),
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];

    assert.isTrue(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if values are mixed', () => {
    const localValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
      {
        identifier: 'contact' as const,
        contact: {
          uuid: 'f59a9fed-9e91-4bb4-a015-d49e58b47e25',
          e164: '+17865554321',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];
    const remoteValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: 'f59a9fed-9e91-4bb4-a015-d49e58b47e25',
          e164: '+17865554321',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];

    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if lengths are not same', () => {
    const localValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];
    const remoteValue: Array<PinnedConversationClass> = [];
    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });

  it('is not equal if content does not match', () => {
    const localValue = [
      {
        identifier: 'contact' as const,
        contact: {
          uuid: '72313cde-2784-4a6f-a92a-abbe23763a60',
          e164: '+13055551234',
        },
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];
    const remoteValue = [
      {
        identifier: 'groupMasterKey' as const,
        groupMasterKey: new ArrayBuffer(32),
        toArrayBuffer: () => new ArrayBuffer(0),
      },
    ];
    assert.isFalse(arePinnedConversationsEqual(localValue, remoteValue));
  });
});
