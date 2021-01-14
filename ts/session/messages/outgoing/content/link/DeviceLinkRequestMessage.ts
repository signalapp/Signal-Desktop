import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { Constants } from '../../../..';
export interface DeviceLinkMessageParams extends MessageParams {
  primaryDevicePubKey: string;
  secondaryDevicePubKey: string;
  requestSignature: Uint8Array;
}

export class DeviceLinkRequestMessage extends ContentMessage {
  protected readonly primaryDevicePubKey: string;
  protected readonly secondaryDevicePubKey: string;
  protected readonly requestSignature: Uint8Array;

  constructor(params: DeviceLinkMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });

    if (!(params.requestSignature instanceof Uint8Array)) {
      throw new TypeError('requestSignature must be of type Uint8Array');
    }
    if (typeof params.primaryDevicePubKey !== 'string') {
      throw new TypeError('primaryDevicePubKey must be of type string');
    }
    if (typeof params.secondaryDevicePubKey !== 'string') {
      throw new TypeError('secondaryDevicePubKey must be of type string');
    }
    this.primaryDevicePubKey = params.primaryDevicePubKey;
    this.secondaryDevicePubKey = params.secondaryDevicePubKey;
    this.requestSignature = params.requestSignature;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.PAIRING_REQUEST;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      pairingAuthorisation: this.getPairingAuthorisationMessage(),
      dataMessage: this.getDataMessage(),
    });
  }

  protected getDataMessage(): SignalService.DataMessage | undefined {
    return undefined;
  }

  protected getPairingAuthorisationMessage(): SignalService.PairingAuthorisationMessage {
    return new SignalService.PairingAuthorisationMessage({
      primaryDevicePubKey: this.primaryDevicePubKey,
      secondaryDevicePubKey: this.secondaryDevicePubKey,
      requestSignature: new Uint8Array(this.requestSignature),
      grantSignature: null,
    });
  }
}
