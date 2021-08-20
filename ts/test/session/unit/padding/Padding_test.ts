// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import { describe } from 'mocha';

import chaiAsPromised from 'chai-as-promised';
import {
  addAttachmentPadding,
  addMessagePadding,
  getUnpaddedAttachment,
  removeMessagePadding,
} from '../../../../session/crypto/BufferPadding';
chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('Padding', () => {
  describe('Attachment padding', () => {
    it('add padding', () => {
      const bufferIn = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const paddedBuffer = addAttachmentPadding(bufferIn);
      expect(paddedBuffer.byteLength).to.equal(541);
      expect(new Uint8Array(paddedBuffer.slice(0, bufferIn.length))).to.equalBytes(bufferIn);
      // this makes sure that the padding is just the 0 bytes
      expect(new Uint8Array(paddedBuffer.slice(bufferIn.length))).to.equalBytes(
        new Uint8Array(541 - bufferIn.length)
      );
    });

    it('remove padding', () => {
      // padding can be anything after the expected size
      const expectedSize = 10;
      const paddedBuffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 5]);

      const paddingRemoveBuffer = getUnpaddedAttachment(paddedBuffer, expectedSize);

      expect(paddingRemoveBuffer?.byteLength).to.equal(expectedSize);
      expect(paddingRemoveBuffer).to.equalBytes(paddedBuffer.slice(0, expectedSize));
    });
  });

  describe('Message padding', () => {
    it('add padding', () => {
      const bufferIn = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      const paddedMessage = addMessagePadding(bufferIn);
      expect(paddedMessage.byteLength).to.equal(159);
      // for message padding, we have [bufferIn, 0x80, 0x00, 0x00, 0x00, ...]
      expect(new Uint8Array(paddedMessage.slice(0, bufferIn.length))).to.equalBytes(bufferIn);
      expect(paddedMessage[bufferIn.length]).to.equal(0x80);
      // this makes sure that the padding is just the 0 bytes
      expect(new Uint8Array(paddedMessage.slice(bufferIn.length + 1))).to.equalBytes(
        new Uint8Array(159 - bufferIn.length - 1)
      );
    });

    it('remove padding', () => {
      const expectedSize = 10;
      const paddedBuffer = new Uint8Array([
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        128,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ]);

      const unpaddedMessage = removeMessagePadding(paddedBuffer);
      // for message padding, we have [paddedBuffer, 0x80, 0x00, 0x00, 0x00, ...]
      expect(unpaddedMessage?.byteLength).to.equal(expectedSize);
      expect(new Uint8Array(unpaddedMessage)).to.equalBytes(paddedBuffer.slice(0, expectedSize));
    });
  });
});
