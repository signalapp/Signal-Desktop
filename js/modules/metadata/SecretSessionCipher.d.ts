import { SignalService } from '../../protobuf';
import { CipherTextObject } from '../../../libtextsecure/libsignal-protocol';

export interface SecretSessionCipherConstructor {
  new (storage: any): SecretSessionCipherInterface;
}

export interface SecretSessionCipherInterface {
  encrypt(
    destinationPubkey: string,
    senderCertificate: SignalService.SenderCertificate,
    innerEncryptedMessage: CipherTextObject
  ): Promise<ArrayBuffer>;
  decrypt(
    cipherText: ArrayBuffer,
    me: { number: string; deviceId: number }
  ): Promise<{
    isMe?: boolean;
    sender: string;
    content: ArrayBuffer;
    type: SignalService.Envelope.Type;
  }>;
}

export declare class SecretSessionCipher
  implements SecretSessionCipherInterface {
  constructor(storage: any);
  public encrypt(
    destinationPubkey: string,
    senderCertificate: SignalService.SenderCertificate,
    innerEncryptedMessage: CipherTextObject
  ): Promise<ArrayBuffer>;
  public decrypt(
    cipherText: ArrayBuffer,
    me: { number: string; deviceId: number }
  ): Promise<{
    isMe?: boolean;
    sender: string;
    content: ArrayBuffer;
    type: SignalService.Envelope.Type;
  }>;
}
