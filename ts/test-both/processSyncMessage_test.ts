// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { UUID } from '../types/UUID';

import { processSyncMessage } from '../textsecure/processSyncMessage';

describe('processSyncMessage', () => {
  const destinationUuid = UUID.generate().toString();

  it('should normalize UUIDs in sent (aci)', () => {
    const out = processSyncMessage({
      sent: {
        destinationAci: destinationUuid.toUpperCase(),

        unidentifiedStatus: [
          {
            destinationAci: destinationUuid.toUpperCase(),
          },
        ],
      },
    });

    assert.deepStrictEqual(out, {
      sent: {
        destinationUuid: {
          aci: destinationUuid,
          pni: undefined,
        },

        storyMessageRecipients: undefined,
        unidentifiedStatus: [
          {
            destinationUuid: {
              aci: destinationUuid,
              pni: undefined,
            },
          },
        ],
      },
    });
  });

  it('should normalize UUIDs in sent (pni)', () => {
    const out = processSyncMessage({
      sent: {
        destinationPni: destinationUuid.toUpperCase(),

        unidentifiedStatus: [
          {
            destinationPni: destinationUuid.toUpperCase(),
          },
        ],
      },
    });

    assert.deepStrictEqual(out, {
      sent: {
        destinationUuid: {
          aci: undefined,
          pni: destinationUuid,
        },

        storyMessageRecipients: undefined,
        unidentifiedStatus: [
          {
            destinationUuid: {
              aci: undefined,
              pni: destinationUuid,
            },
          },
        ],
      },
    });
  });
});
