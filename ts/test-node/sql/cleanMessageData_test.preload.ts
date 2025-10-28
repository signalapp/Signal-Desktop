// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { _cleanMessageData } from '../../sql/Client.preload.js';
import { IMAGE_GIF } from '../../types/MIME.std.js';

describe('_cleanMessageData', () => {
  it('throws if message is missing received_at', () => {
    assert.throws(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _cleanMessageData({} as any);
    }, 'received_at');
  });

  it('removes `data` field in attachment if it is not a typed array', () => {
    const data = new Uint8Array([1, 2, 3]);
    const message = {
      id: 'something',
      type: 'incoming' as const,
      sent_at: Date.now(),
      conversationId: 'conversation-id',
      received_at: Date.now(),
      timestamp: Date.now(),
      attachments: [
        {
          contentType: IMAGE_GIF,
          size: 4,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: 1 as any,
        },
        {
          contentType: IMAGE_GIF,
          size: 4,
          data: {},
        },
        {
          size: 4,
          contentType: IMAGE_GIF,
          data,
        },
      ],
    };
    const actual = _cleanMessageData(message);

    assert.isUndefined(actual.attachments?.[0].data);
    assert.isUndefined(actual.attachments?.[1].data);
    assert.strictEqual(actual.attachments?.[2].data, data);
  });
});
