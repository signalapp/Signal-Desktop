import { SignalService } from '../../../../protobuf';
import { CipherTextObject } from '../../../../../libtextsecure/libsignal-protocol';
import { SecretSessionCipherInterface } from '../../../../../js/modules/metadata/SecretSessionCipher';

export class SecretSessionCipherStub implements SecretSessionCipherInterface {
  public async encrypt(
    _destinationPubkey: string,
    _senderCertificate: SignalService.SenderCertificate,
    innerEncryptedMessage: CipherTextObject
  ): Promise<ArrayBuffer> {
    const { body } = innerEncryptedMessage;

    return Buffer.from(body, 'binary').buffer;
  }

  public async decrypt(
    _cipherText: ArrayBuffer,
    _me: { number: string; deviceId: number }
  ): Promise<{
    isMe?: boolean;
    sender: string;
    content: ArrayBuffer;
    type: SignalService.Envelope.Type;
  }> {
    throw new Error('Not implemented');
  }
}
