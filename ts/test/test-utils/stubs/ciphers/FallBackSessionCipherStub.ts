import { CipherTextObject } from '../../../../../libtextsecure/libsignal-protocol';
import { SignalService } from '../../../../protobuf';
import { StringUtils } from '../../../../session/utils';

export class FallBackSessionCipherStub {
  public async encrypt(buffer: ArrayBuffer): Promise<CipherTextObject> {
    return {
      type: SignalService.Envelope.Type.SESSION_REQUEST,
      body: StringUtils.decode(buffer, 'binary'),
    };
  }
}
