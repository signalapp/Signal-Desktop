import { expect } from 'chai';
import { ImportMock, MockManager } from 'ts-mock-imports';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import * as window from '../../../window';
import { MessageEncrypter } from '../../../session/crypto';
import { EncryptionType } from '../../../session/types/EncryptionType';
import { Stubs } from '../../test-utils';
import { UserUtil } from '../../../util';

describe('MessageEncrypter', () => {
  const sandbox = sinon.createSandbox();

  let sessionCipherStub: MockManager<Stubs.SessionCipherBasicStub>;
  beforeEach(() => {
    sessionCipherStub = ImportMock.mockClass(Stubs, 'SessionCipherBasicStub');
    ImportMock.mockOther(window, 'libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherBasicStub,
    } as any);

    ImportMock.mockOther(window, 'textsecure', {
      storage: {
        protocol: sandbox.stub(),
      },
    });

    ImportMock.mockFunction(UserUtil, 'getCurrentDevicePubKey', '1');
  });

  afterEach(() => {
    sandbox.restore();
    ImportMock.restore();
  });

  describe('EncryptionType', () => {
    describe('MediumGroup', () => {
      it('should throw an error', async () => {
        const data = crypto.randomBytes(10);
        const promise = MessageEncrypter.encrypt(
          '1',
          data,
          EncryptionType.MediumGroup
        );
        await expect(promise).to.be.rejectedWith(
          'Encryption is not yet supported'
        );
      });
    });

    /*
    describe('SessionReset', () => {
      it('should call FallbackSessionCipher', async () => {
      });

      it('should pass the padded message body to encrypt', async () => {
      });
    });
    */
    describe('Signal', () => {
      it('should call SessionCipher encrypt', async () => {
        const data = crypto.randomBytes(10);
        const stub = sessionCipherStub.mock('encrypt').resolves({
          type: 1,
          body: 'body',
        });
        await MessageEncrypter.encrypt('1', data, EncryptionType.Signal);
        expect(stub.called).to.equal(
          true,
          'SessionCipher.encrypt should be called.'
        );
      });

      it('should pass the padded message body to encrypt', async () => {});
    });
  });
});
