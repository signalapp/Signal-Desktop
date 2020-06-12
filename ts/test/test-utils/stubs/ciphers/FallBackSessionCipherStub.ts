import { CipherTextObject } from '../../../../../libtextsecure/libsignal-protocol';
import { SignalService } from '../../../../protobuf';

export class FallBackSessionCipherStub {
  public async encrypt(buffer: ArrayBuffer): Promise<CipherTextObject> {
    return {
      type: SignalService.Envelope.Type.SESSION_REQUEST,
      body: Buffer.from(buffer).toString('binary'),
    };
  }
}
