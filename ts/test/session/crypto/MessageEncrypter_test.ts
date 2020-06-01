import { expect } from 'chai';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import * as window from '../../../window';
import { MessageEncrypter } from '../../../session/crypto';
import { EncryptionType } from '../../../session/types/EncryptionType';

describe('MessageEncrypter', () => {
  const sandbox = sinon.sandbox.create();

  beforeEach(() => {
    sandbox.stub(window);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('EncryptionType', () => {
    describe('MediumGroup', () => {
      it('should throw an error', async () => {
        const data = crypto.randomBytes(10);
        const promise = MessageEncrypter.encrypt('1', data, EncryptionType.MediumGroup);
        await expect(promise).to.be.rejectedWith('Encryption is not yet supported');
      });
    });

    /*
    describe('SessionReset', () => {
      it('should call FallbackSessionCipher', async () => {
      });

      it('should pass the padded message body to encrypt', async () => {
      });
    });

    describe('Signal', () => {
      it('should call SessionCipher', async () => {

      });

      it('should pass the padded message body to encrypt', async () => {
      });
    });
    */
  });
});
