import { assert } from 'chai';
import moment from 'moment';

import * as Attachment from '../../types/Attachment';
import * as MIME from '../../types/MIME';
import { SignalService } from '../../protobuf';
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
        const timestamp = moment('2000-01-01').toDate();
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp,
        });
        const expected = 'session-attachment-2000-01-01-000000.mov';
        assert.strictEqual(actual, expected);
      });
    });
    context('for attachment with index', () => {
      it('should generate a filename based on timestamp', () => {
        const attachment: Attachment.Attachment = {
          data: stringToArrayBuffer('foo'),
          contentType: MIME.VIDEO_QUICKTIME,
        };
        const timestamp = new Date(new Date(0).getTimezoneOffset() * 60 * 1000);
        const actual = Attachment.getSuggestedFilename({
          attachment,
          timestamp,
          index: 3,
        });
        const expected = 'session-attachment-1970-01-01-000000_003.mov';
        assert.strictEqual(actual, expected);
      });
    });
  });

  describe('isVisualMedia', () => {
    it('should return true for images', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'meme.gif',
        data: stringToArrayBuffer('gif'),
        contentType: MIME.IMAGE_GIF,
      };
      assert.isTrue(Attachment.isVisualMedia(attachment));
    });

    it('should return true for videos', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'meme.mp4',
        data: stringToArrayBuffer('mp4'),
        contentType: MIME.VIDEO_MP4,
      };
      assert.isTrue(Attachment.isVisualMedia(attachment));
    });

    it('should return false for voice message attachment', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'Voice Message.aac',
        flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer('voice message'),
        contentType: MIME.AUDIO_AAC,
      };
      assert.isFalse(Attachment.isVisualMedia(attachment));
    });

    it('should return false for other attachments', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'foo.json',
        data: stringToArrayBuffer('{"foo": "bar"}'),
        contentType: MIME.APPLICATION_JSON,
      };
      assert.isFalse(Attachment.isVisualMedia(attachment));
    });
  });

  describe('isFile', () => {
    it('should return true for JSON', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'foo.json',
        data: stringToArrayBuffer('{"foo": "bar"}'),
        contentType: MIME.APPLICATION_JSON,
      };
      assert.isTrue(Attachment.isFile(attachment));
    });

    it('should return false for images', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'meme.gif',
        data: stringToArrayBuffer('gif'),
        contentType: MIME.IMAGE_GIF,
      };
      assert.isFalse(Attachment.isFile(attachment));
    });

    it('should return false for videos', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'meme.mp4',
        data: stringToArrayBuffer('mp4'),
        contentType: MIME.VIDEO_MP4,
      };
      assert.isFalse(Attachment.isFile(attachment));
    });

    it('should return false for voice message attachment', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'Voice Message.aac',
        flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer('voice message'),
        contentType: MIME.AUDIO_AAC,
      };
      assert.isFalse(Attachment.isFile(attachment));
    });
  });

  describe('isVoiceMessage', () => {
    it('should return true for voice message attachment', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'Voice Message.aac',
        flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE,
        data: stringToArrayBuffer('voice message'),
        contentType: MIME.AUDIO_AAC,
      };
      assert.isTrue(Attachment.isVoiceMessage(attachment));
    });

    it('should return true for legacy Android voice message attachment', () => {
      const attachment: Attachment.Attachment = {
        data: stringToArrayBuffer('voice message'),
        contentType: MIME.AUDIO_MP3,
      };
      assert.isTrue(Attachment.isVoiceMessage(attachment));
    });

    it('should return false for other attachments', () => {
      const attachment: Attachment.Attachment = {
        fileName: 'foo.gif',
        data: stringToArrayBuffer('foo'),
        contentType: MIME.IMAGE_GIF,
      };
      assert.isFalse(Attachment.isVoiceMessage(attachment));
    });
  });
});
