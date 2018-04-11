import 'mocha';
import { assert } from 'chai';

import * as Message from '../../../../ts/types/message/initializeAttachmentMetadata';
import { IncomingMessage } from '../../../../ts/types/Message';
import { MIMEType } from '../../../../ts/types/MIME';
// @ts-ignore
import { stringToArrayBuffer } from '../../../../js/modules/string_to_array_buffer';


describe('Message', () => {
  describe('initializeAttachmentMetadata', () => {
    it('should handle visual media attachments', async () => {
      const input: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [{
          contentType: 'image/jpeg' as MIMEType,
          data: stringToArrayBuffer('foo'),
          fileName: 'foo.jpg',
          size: 1111,
        }],
      };
      const expected: IncomingMessage = {
        type: 'incoming',
        conversationId: 'foo',
        id: '11111111-1111-1111-1111-111111111111',
        timestamp: 1523317140899,
        received_at: 1523317140899,
        sent_at: 1523317140800,
        attachments: [{
          contentType: 'image/jpeg' as MIMEType,
          data: stringToArrayBuffer('foo'),
          fileName: 'foo.jpg',
          size: 1111,
        }],
        numAttachments: 1,
        numVisualMediaAttachments: 1,
        numFileAttachments: 0,
      };

      const actual = await Message.initializeAttachmentMetadata(input);
      assert.deepEqual(actual, expected);
    });
  });
});
