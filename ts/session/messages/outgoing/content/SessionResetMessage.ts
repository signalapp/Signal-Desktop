import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';

export interface PreKeyBundleType {
  identityKey: Uint8Array;
  deviceId: number;
  preKeyId: number;
  signedKeyId: number;
  preKey: Uint8Array;
  signedKey: Uint8Array;
  signature: Uint8Array;
}

interface SessionResetParams extends MessageParams {
  preKeyBundle: PreKeyBundleType;
}

export class SessionResetMessage extends ContentMessage {
  private readonly preKeyBundle: PreKeyBundleType;

  constructor(params: SessionResetParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.preKeyBundle = params.preKeyBundle;
  }

  public ttl(): number {
    return 4 * 24 * 60 * 60 * 1000; // 4 days
  }

  protected getPreKeyBundleMessage(): SignalService.PreKeyBundleMessage {
    return new SignalService.PreKeyBundleMessage(this.preKeyBundle);
  }

  protected contentProto(): SignalService.Content {
    const nullMessage = new SignalService.NullMessage({});
    const preKeyBundleMessage = this.getPreKeyBundleMessage();

    return new SignalService.Content({
      nullMessage,
      preKeyBundleMessage,
    });
  }
}
