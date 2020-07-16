import { CipherTextObject } from '../../../../../libtextsecure/libsignal-protocol';
import { SignalService } from '../../../../protobuf';
import { StringUtils } from '../../../../session/utils';

export class FallBackSessionCipherStub {
  public async encrypt(buffer: ArrayBuffer): Promise<CipherTextObject> {
    return {
      type: SignalService.Envelope.Type.FALLBACK_MESSAGE,
      body: StringUtils.decode(buffer, 'binary'),
    };
  }
}
