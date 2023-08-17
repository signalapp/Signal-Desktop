import { expect } from 'chai';
import { SignalService } from '../../protobuf';
import {
  getAttachmentMetadata,
  hasFileAttachmentInMessage,
  hasVisualMediaAttachmentInMessage,
} from '../../types/message/initializeAttachmentMetadata';
import { generateFakeIncomingPrivateMessage, stubWindowLog } from '../test-utils/utils';

describe('initializeAttachmentMetadata', () => {
  beforeEach(() => {
    stubWindowLog();
  });
  describe('hasAttachmentInMessage', () => {
    it('no attachments should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();

      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('empty list attachments should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment has undefined content type should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: undefined }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment has null content type should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: null }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('first attachment is gif should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/gif' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is gif should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/gif' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is jpeg should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/jpeg' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is png should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/png' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is JPG should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/JPG' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is PNG should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'image/PNG' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is audio should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'audio/mp3' }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is flagged as voice message should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [
          { contentType: 'audio/mp3', flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE },
        ],
      });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment is flagged as voice message but no content type is false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [
          { contentType: undefined, flags: SignalService.AttachmentPointer.Flags.VOICE_MESSAGE },
        ],
      });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment content type is audio and other is null should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({ attachments: [{ contentType: 'audio/mp3' }, { contentType: null }] });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('first attachment content type is audio and other is null should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'audio/mp3' }, { contentType: 'file/whatever' }],
      });
      expect(hasFileAttachmentInMessage(msgModel)).to.be.eq(true);
    });
  });

  describe('hasVisualMediaAttachmentInMessage', () => {
    it('no attachments should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();

      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('empty attachments list should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment type is undefined should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: undefined }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment type is null should return false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: null }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(false);
    });

    it('first attachment type is image/whatever should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'image/whatever' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('first attachment type is jpeg should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'image/jpeg' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('first attachment type is png should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'image/png' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('first attachment type is JPG should return true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'image/JPG' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('multiple attachments where one is not image and one is returns true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'audio/whatever' }, { contentType: 'image/JPG' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('multiple attachments where both are images returns true', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'image/whatever' }, { contentType: 'image/JPG' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(true);
    });

    it('multiple attachments  where none are images returns false', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set({
        attachments: [{ contentType: 'audio/whatever' }, { contentType: 'audio/JPG' }],
      });
      expect(hasVisualMediaAttachmentInMessage(msgModel)).to.be.eq(false);
    });
  });

  describe('getAttachmentMetadata', () => {
    it('no attachments should return false x3', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(0);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('empty attachments [] should return false x3', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', []);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(0);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('has one image attachment only', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: 'image/jpeg' }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(1);
    });

    it('has two image attachment only', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: 'image/jpeg' }, { contentType: 'image/jpeg' }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(1);
    });

    it('has one audio attachment only', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: 'audio/mp3' }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('has one file attachment only', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: 'whatever' }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(1);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('has two file attachment only', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: 'whatever' }, { contentType: 'whatever' }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(1);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('has two attachments with undefined contenttype', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: undefined }, { contentType: undefined }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(0);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });

    it('has two attachments with null contenttype', () => {
      const msgModel = generateFakeIncomingPrivateMessage();
      msgModel.set('attachments', [{ contentType: null }, { contentType: null }]);
      const mt = getAttachmentMetadata(msgModel);
      expect(mt.hasAttachments).to.be.eq(1);
      expect(mt.hasFileAttachments).to.be.eq(1);
      expect(mt.hasVisualMediaAttachments).to.be.eq(0);
    });
  });
});
