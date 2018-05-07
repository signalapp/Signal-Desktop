/**
 * @prettier
 */
import 'mocha';
import { assert } from 'chai';

import * as Attachment from '../../types/Attachment';
import * as MIME from '../../types/MIME';
// @ts-ignore
import { stringToArrayBuffer } from '../../../js/modules/string_to_array_buffer';

describe('Attachment', () => {
  describe('getFileExtension', () => {
    it('should return file extension from content type', () => {
      const input: Attachment.Attachment = {
        data: stringToArrayBuffer('foo'),
        contentType: MIME.IMAGE_GIF,
      };
      assert.strictEqual(Attachment.getFileExtension(input), 'gif');
    });

    it('should return file extension for QuickTime videos', () => {
      const input: Attachment.Attachment = {
        data: stringToArrayBuffer('foo'),
        contentType: MIME.VIDEO_QUICKTIME,
      };
      assert.strictEqual(Attachment.getFileExtension(input), 'mov');
    });
  });

  describe('getSuggestedFilename', () => {
    context('for attachment with filename', () => {
      it('should return existing filename if present', () => {
        const attachment: Attachment.Attachment = {
          fileName: 'funny-cat.mov',
          data: stringToArrayBuffer('foo'),
          contentType: MIME.VIDEO_QUICKTIME,
        };
        const actual = Attachment.getSuggestedFilename({ attachment });
        const expected = 'funny-cat.mov';
        assert.strictEqual(actual, expected);
      });
    });
    context('for attachment without filename', () => {
      it('should generate a filename based on timestamp', () => {
        const attachment: Attachment.Attachment = {
          data: stringToArrayBuffer('foo'),
          contentType: MIME.VIDEO_QUICKTIME,
        };
        const timestamp = new Date(new Date(0).getTimezoneOffset() * 60 * 1000);
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp,
        });
        const expected = 'signal-attachment-1970-01-01-000000.mov';
        assert.strictEqual(actual, expected);
      });
    });
  });
});
