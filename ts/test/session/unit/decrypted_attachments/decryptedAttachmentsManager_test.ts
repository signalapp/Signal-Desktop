import { expect } from 'chai';
import { beforeEach } from 'mocha';
import Sinon from 'sinon';
import * as DecryptedAttachmentsManager from '../../../../session/crypto/DecryptedAttachmentsManager';
import { TestUtils } from '../../../test-utils';

describe('DecryptedAttachmentsManager', () => {
  beforeEach(() => {
    DecryptedAttachmentsManager.resetDecryptedUrlForTesting();
    TestUtils.stubWindowLog();
    Sinon.stub(DecryptedAttachmentsManager, 'getLocalAttachmentPath').returns('/local/attachment');
    Sinon.stub(DecryptedAttachmentsManager, 'getAbsoluteAttachmentPath').returns;
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('getAlreadyDecryptedMediaUrl', () => {
    describe('invalid url', () => {
      it('url is null', () => {
        expect(DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl(null as any)).to.be.null;
      });

      it('url is undefined', () => {
        expect(DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl(undefined as any)).to.be
          .null;
      });

      it('url is empty string', () => {
        expect(DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('')).to.be.null;
      });

      it('url starts with something not being the attachment path', () => {
        expect(DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('/local/notvalid')).to.be
          .null;
      });
    });
    it('url starts with "blob:" => returns the already decrypted url right away', () => {
      expect(DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('blob:whatever')).to.be.eq(
        'blob:whatever'
      );
    });

    describe('url starts with attachmentPath', () => {
      let readFileContent: Sinon.SinonStub;
      let getItemById: Sinon.SinonStub;
      let decryptAttachmentBufferNode: Sinon.SinonStub;

      beforeEach(() => {
        readFileContent = Sinon.stub(DecryptedAttachmentsManager, 'readFileContent').resolves(
          Buffer.from('this is a test')
        );
        getItemById = TestUtils.stubData('getItemById')
          .withArgs('local_attachment_encrypted_key')
          .callsFake(async () => {
            return { value: 'dfdf' };
          });

        decryptAttachmentBufferNode = TestUtils.stubUtilWorker(
          'decryptAttachmentBufferNode',
          new Uint8Array(5)
        );
        TestUtils.stubCreateObjectUrl();
      });

      it('url starts with attachment path but is not already decrypted', () => {
        expect(
          DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('/local/attachment/attachment1')
        ).to.be.eq(null);
      });

      it('url starts with attachment path but is not already decrypted', async () => {
        expect(
          DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('/local/attachment/attachment1')
        ).to.be.eq(null);

        expect(readFileContent.callCount).to.be.eq(0);
        expect(decryptAttachmentBufferNode.callCount).to.be.eq(0);
        expect(getItemById.callCount).to.be.eq(0);

        const resolved = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
          '/local/attachment/attachment1',
          'image/jpeg',
          false
        );

        expect(readFileContent.callCount).to.be.eq(1);
        expect(decryptAttachmentBufferNode.callCount).to.be.eq(1);
        expect(getItemById.callCount).to.be.eq(1);

        const now = `${Date.now()}`;
        expect(resolved).to.be.not.empty;
        expect(resolved.startsWith(now.slice(0, 9))).to.be.true;
      });

      it('url starts with attachment path and is already decrypted', async () => {
        expect(
          DecryptedAttachmentsManager.getAlreadyDecryptedMediaUrl('/local/attachment/attachment1')
        ).to.be.eq(null);

        expect(readFileContent.callCount).to.be.eq(0);
        expect(decryptAttachmentBufferNode.callCount).to.be.eq(0);
        expect(getItemById.callCount).to.be.eq(0);

        const resolved = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
          '/local/attachment/attachment1',
          'image/jpeg',
          false
        );

        expect(readFileContent.callCount).to.be.eq(1);
        expect(decryptAttachmentBufferNode.callCount).to.be.eq(1);
        expect(getItemById.callCount).to.be.eq(1);

        const now = `${Date.now()}`;
        expect(resolved).to.be.not.empty;
        expect(resolved.startsWith(now.slice(0, 9))).to.be.true;

        const resolved2 = await DecryptedAttachmentsManager.getDecryptedMediaUrl(
          '/local/attachment/attachment1',
          'image/jpeg',
          false
        );

        // should not try to decrypt nor read from file again
        expect(readFileContent.callCount).to.be.eq(1);
        expect(decryptAttachmentBufferNode.callCount).to.be.eq(1);
        expect(getItemById.callCount).to.be.eq(1);

        const now2 = `${Date.now()}`;
        expect(resolved2).to.be.not.empty;
        expect(resolved2.startsWith(now2.slice(0, 9))).to.be.true;
      });
    });
  });

  it.skip('cleanUpOldDecryptedMedias', () => {});
  it.skip('getDecryptedBlob', () => {});
});
