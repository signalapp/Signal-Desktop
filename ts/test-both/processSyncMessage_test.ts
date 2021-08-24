// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import getGuid from 'uuid/v4';

import { processSyncMessage } from '../textsecure/processSyncMessage';

describe('processSyncMessage', () => {
  it('should normalize UUIDs in sent', () => {
    const destinationUuid = getGuid();

    const out = processSyncMessage({
      sent: {
        destinationUuid: destinationUuid.toUpperCase(),

        unidentifiedStatus: [
          {
            destinationUuid: destinationUuid.toUpperCase(),
          },
        ],
      },
    });

    assert.deepStrictEqual(out, {
      sent: {
        destinationUuid,

        unidentifiedStatus: [
          {
            destinationUuid,
          },
        ],
      },
    });
  });
});
