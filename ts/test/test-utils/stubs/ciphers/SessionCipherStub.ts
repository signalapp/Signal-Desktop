import { CipherTextObject } from '../../../../window/types/libsignal-protocol';
import { SignalService } from '../../../../protobuf';

export class SessionCipherStub {
  public storage: any;
  public address: any;
  constructor(storage: any, address: any) {
    this.storage = storage;
    this.address = address;
  }

  public async encrypt(
    buffer: ArrayBuffer | Uint8Array
  ): Promise<CipherTextObject> {
    return {
      type: SignalService.Envelope.Type.CIPHERTEXT,
      body: Buffer.from(buffer).toString('binary'),
    };
  }

  public async hasOpenSession(): Promise<Boolean> {
    return false;
  }
}
