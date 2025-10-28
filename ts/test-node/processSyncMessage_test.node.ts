// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { generateAci } from '../types/ServiceId.std.js';

import { processSyncMessage } from '../textsecure/processSyncMessage.node.js';

describe('processSyncMessage', () => {
  const destinationServiceId = generateAci();

  it('should normalize UUIDs in sent', () => {
    const out = processSyncMessage({
      sent: {
        destinationServiceId: destinationServiceId.toUpperCase(),

        unidentifiedStatus: [
          {
            destinationServiceId: destinationServiceId.toUpperCase(),
          },
        ],
      },
    });

    assert.deepStrictEqual(out, {
      sent: {
        destinationServiceId,

        storyMessageRecipients: undefined,
        unidentifiedStatus: [
          {
            destinationServiceId,
          },
        ],
      },
    });
  });
});
