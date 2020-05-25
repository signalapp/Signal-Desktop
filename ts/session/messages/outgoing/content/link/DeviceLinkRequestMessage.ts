import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';
interface DeviceLinkMessageParams {
  timestamp: number;
  identifier: string;

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
    this.primaryDevicePubKey = params.primaryDevicePubKey;
    this.secondaryDevicePubKey = params.secondaryDevicePubKey;
    this.requestSignature = params.requestSignature;
  }

  public ttl(): number {
    return 2 * 60 * 1000; // 2 minutes for pairing requests
  }

  protected getDataMessage(): SignalService.DataMessage | null {
    return null;
  }

  protected getPairingAuthorisationMessage(): SignalService.PairingAuthorisationMessage {
    return new SignalService.PairingAuthorisationMessage({
      primaryDevicePubKey: this.primaryDevicePubKey,
      secondaryDevicePubKey: this.secondaryDevicePubKey,
      requestSignature: this.requestSignature,
      grantSignature: null,
    });
  }

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      pairingAuthorisation: this.getPairingAuthorisationMessage(),
      dataMessage: this.getDataMessage() || null,
    });
  }
}

