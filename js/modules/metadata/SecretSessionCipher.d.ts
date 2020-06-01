import { SignalService } from '../../../ts/protobuf';
import {
  BinaryString,
  CipherTextObject,
} from '../../../libtextsecure/libsignal-protocol';

export declare class SecretSessionCipher {
  constructor(storage: any);
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
