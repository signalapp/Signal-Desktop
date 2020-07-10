import { expect } from 'chai';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import { MessageEncrypter } from '../../../session/crypto';
import { EncryptionType } from '../../../session/types/EncryptionType';
import { Stubs, TestUtils } from '../../test-utils';
import { UserUtil } from '../../../util';
import { SignalService } from '../../../protobuf';

// tslint:disable-next-line: max-func-body-length
describe('MessageEncrypter', () => {
  const sandbox = sinon.createSandbox();
  const ourNumber = 'ourNumber';

  beforeEach(() => {
    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
      SessionCipher: Stubs.SessionCipherStub,
    } as any);

    TestUtils.stubWindow('textsecure', {
      storage: {
        protocol: sandbox.stub(),
      },
    });

    TestUtils.stubWindow('Signal', {
      Metadata: {
        SecretSessionCipher: Stubs.SecretSessionCipherStub,
      },
    });

    TestUtils.stubWindow('libloki', {
      crypto: {
        FallBackSessionCipher: Stubs.FallBackSessionCipherStub,
      } as any,
    });

    sandbox.stub(UserUtil, 'getCurrentDevicePubKey').resolves(ourNumber);
  });

  afterEach(() => {
    sandbox.restore();
    TestUtils.restoreStubs();
  });

  describe('EncryptionType', () => {
    describe('MediumGroup', () => {
      it('should throw an error', async () => {
        const data = crypto.randomBytes(10);
        const promise = MessageEncrypter.encrypt(
          TestUtils.generateFakePubKey(),
          data,
          EncryptionType.MediumGroup
        );
        await expect(promise).to.be.rejectedWith(
          'Encryption is not yet supported'
        );
      });
    });

    describe('SessionRequest', () => {
      it('should call FallbackSessionCipher encrypt', async () => {
        const data = crypto.randomBytes(10);
        const spy = sandbox.spy(
          Stubs.FallBackSessionCipherStub.prototype,
          'encrypt'
        );
        await MessageEncrypter.encrypt(TestUtils.generateFakePubKey(), data, EncryptionType.Fallback);
        expect(spy.called).to.equal(
          true,
          'FallbackSessionCipher.encrypt should be called.'
        );
      });

      it('should pass the padded message body to encrypt', async () => {
        const data = crypto.randomBytes(10);
        const spy = sandbox.spy(
          Stubs.FallBackSessionCipherStub.prototype,
          'encrypt'
        );
        await MessageEncrypter.encrypt(TestUtils.generateFakePubKey(), data, EncryptionType.Fallback);

        const paddedData = MessageEncrypter.padPlainTextBuffer(data);
        const firstArgument = new Uint8Array(spy.args[0][0]);
        expect(firstArgument).to.deep.equal(paddedData);
      });

      it('should return an UNIDENTIFIED SENDER envelope type', async () => {
        const data = crypto.randomBytes(10);
        const result = await MessageEncrypter.encrypt(
          TestUtils.generateFakePubKey(),
          data,
          EncryptionType.Fallback
        );
        expect(result.envelopeType).to.deep.equal(
          SignalService.Envelope.Type.UNIDENTIFIED_SENDER
        );
      });
    });

    describe('Signal', () => {
      it('should call SessionCipher encrypt', async () => {
        const data = crypto.randomBytes(10);
        const spy = sandbox.spy(Stubs.SessionCipherStub.prototype, 'encrypt');
        await MessageEncrypter.encrypt(TestUtils.generateFakePubKey(), data, EncryptionType.Signal);
        expect(spy.called).to.equal(
          true,
          'SessionCipher.encrypt should be called.'
        );
      });

      it('should pass the padded message body to encrypt', async () => {
        const data = crypto.randomBytes(10);
        const spy = sandbox.spy(Stubs.SessionCipherStub.prototype, 'encrypt');
        await MessageEncrypter.encrypt(TestUtils.generateFakePubKey(), data, EncryptionType.Signal);

        const paddedData = MessageEncrypter.padPlainTextBuffer(data);
        const firstArgument = new Uint8Array(spy.args[0][0]);
        expect(firstArgument).to.deep.equal(paddedData);
      });

      it('should return an UNIDENTIFIED SENDER envelope type', async () => {
        const data = crypto.randomBytes(10);
        const result = await MessageEncrypter.encrypt(
          TestUtils.generateFakePubKey(),
          data,
          EncryptionType.Signal
        );
        expect(result.envelopeType).to.deep.equal(
          SignalService.Envelope.Type.UNIDENTIFIED_SENDER
        );
      });
    });
  });

  describe('Sealed Sender', () => {
    it('should pass the correct values to SecretSessionCipher encrypt', async () => {
      const types = [EncryptionType.Fallback, EncryptionType.Signal];
      for (const type of types) {
        const spy = sandbox.spy(
          Stubs.SecretSessionCipherStub.prototype,
          'encrypt'
        );

        const user = TestUtils.generateFakePubKey();
        await MessageEncrypter.encrypt(user, crypto.randomBytes(10), type);

        const args = spy.args[0];
        const [device, certificate] = args;

        const expectedCertificate = SignalService.SenderCertificate.create({
          sender: ourNumber,
          senderDevice: 1,
        });

        expect(device).to.equal(user.key);
        expect(certificate.toJSON()).to.deep.equal(
          expectedCertificate.toJSON()
        );

        spy.restore();
      }
    });
  });
});
