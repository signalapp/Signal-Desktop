// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import lodash from 'lodash';
import { signalservice as Proto } from '../protobuf/compiled.std.js';

import { processSent } from '../textsecure/processSyncMessage.node.ts';
import { generateAci } from '../test-helpers/serviceIdUtils.std.ts';

const { omit } = lodash;

describe('processSent', () => {
  const destinationServiceId = generateAci();

  it('should normalize UUIDs in sent', () => {
    const input = Proto.SyncMessage.Sent.decode(
      Proto.SyncMessage.Sent.encode({
        destinationServiceId: destinationServiceId.toUpperCase(),
        destinationServiceIdBinary: null,

        unidentifiedStatus: [
          {
            destinationServiceId: destinationServiceId.toUpperCase(),
            unidentified: null,
            destinationServiceIdBinary: null,
            destinationPniIdentityKey: null,
          },
        ],

        destinationE164: null,
        timestamp: null,
        message: null,
        expirationStartTimestamp: null,
        isRecipientUpdate: null,
        storyMessage: null,
        storyMessageRecipients: null,
        editMessage: null,
      })
    );

    const out = processSent(input);

    assert.deepStrictEqual(out, {
      ...omit(input, 'destinationServiceIdBinary', '$unknown'),
      destinationServiceId,
      unidentifiedStatus: [
        {
          $unknown: [],
          destinationPniIdentityKey: undefined,
          destinationServiceId,
          unidentified: false,
        },
      ],
      storyMessageRecipients: [],
    } as unknown);
  });
});
