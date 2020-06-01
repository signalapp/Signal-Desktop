import { SignalService } from '../../protobuf';
import {
  CipherTextObject,
} from './libsignal-protocol';

export declare class SecretSessionCipher {
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
