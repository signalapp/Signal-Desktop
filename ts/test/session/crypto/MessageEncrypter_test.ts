import { expect } from 'chai';
import { ImportMock, MockManager } from 'ts-mock-imports';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import * as window from '../../../window';
import { MessageEncrypter } from '../../../session/crypto';
import { EncryptionType } from '../../../session/types/EncryptionType';
import * as stubs from '../../utils/stubs';
import { TestUtils } from '../../utils';

describe('MessageEncrypter', () => {
  const sandbox = sinon.createSandbox();

  let sessionCipherStub: MockManager<stubs.SessionCipherBasicStub>;
  beforeEach(() => {
    sessionCipherStub = ImportMock.mockClass(stubs, 'SessionCipherBasicStub');
    ImportMock.mockOther(window, 'libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: stubs.SessionCipherBasicStub,
    } as any);

    ImportMock.mockOther(window, 'textsecure', {
      storage: {
        protocol: sandbox.stub(),
      },
    });

    TestUtils.mockData('getItemById', undefined)
      .withArgs('number_id')
      .resolves({
        id: 'number_id',
        value: 'abc.1',
      });
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
