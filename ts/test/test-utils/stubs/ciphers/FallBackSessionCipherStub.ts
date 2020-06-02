import { CipherTextObject } from '../../../../window/types/libsignal-protocol';
import { SignalService } from '../../../../protobuf';

export class FallBackSessionCipherStub {
  public async encrypt(buffer: ArrayBuffer): Promise<CipherTextObject> {
    return {
      type: SignalService.Envelope.Type.FRIEND_REQUEST,
      body: Buffer.from(buffer).toString('binary'),
    };
  }
}
