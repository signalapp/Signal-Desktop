import { ContentMessage } from './ContentMessage';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';
import { Constants } from '../../..';
import * as crypto from 'crypto';

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
  private readonly padding: Buffer;

  constructor(params: SessionRequestParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.preKeyBundle = params.preKeyBundle;
    // Generate a random int from 1 and 512
    const buffer = crypto.randomBytes(1);

    // tslint:disable-next-line: no-bitwise
    const paddingLength = (new Uint8Array(buffer)[0] & 0x1ff) + 1;

    // Generate a random padding buffer of the chosen size
    this.padding = crypto.randomBytes(paddingLength);
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.SESSION_REQUEST;
  }

  public contentProto(): SignalService.Content {
    const nullMessage = new SignalService.NullMessage({});
    const preKeyBundleMessage = this.getPreKeyBundleMessage();
    nullMessage.padding = this.padding;
    return new SignalService.Content({
      nullMessage,
      preKeyBundleMessage,
    });
  }

  protected getPreKeyBundleMessage(): SignalService.PreKeyBundleMessage {
    return new SignalService.PreKeyBundleMessage(this.preKeyBundle);
  }
}
