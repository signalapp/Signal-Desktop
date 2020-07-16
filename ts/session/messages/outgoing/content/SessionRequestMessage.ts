import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';
import { Constants } from '../../..';

export interface PreKeyBundleType {
  identityKey: Uint8Array;
  deviceId: number;
  preKeyId: number;
  signedKeyId: number;
  preKey: Uint8Array;
  signedKey: Uint8Array;
  signature: Uint8Array;
}

interface SessionRequestParams extends MessageParams {
  preKeyBundle: PreKeyBundleType;
}

export class SessionRequestMessage extends ContentMessage {
  private readonly preKeyBundle: PreKeyBundleType;

  constructor(params: SessionRequestParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.preKeyBundle = params.preKeyBundle;
  }

  public static defaultTTL(): number {
    // Gets the default TTL for Session Request, as
    // public static readonly ttl: number <-- cannot be assigned a non-literal
    return Constants.TTL_DEFAULT.SESSION_REQUEST;
  }

  public ttl(): number {
    return SessionRequestMessage.defaultTTL();
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
