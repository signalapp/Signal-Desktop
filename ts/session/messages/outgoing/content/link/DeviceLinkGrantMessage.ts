import { SignalService } from '../../../../../protobuf';
import {
  DeviceLinkMessageParams,
  DeviceLinkRequestMessage,
} from './DeviceLinkRequestMessage';
import { LokiProfile } from '../../../../../types/Message';

interface DeviceLinkGrantMessageParams extends DeviceLinkMessageParams {
  grantSignature: Uint8Array;
  lokiProfile: LokiProfile;
}

export class DeviceLinkGrantMessage extends DeviceLinkRequestMessage {
  private readonly displayName: string;
  private readonly avatarPointer: string;
  private readonly profileKey: Uint8Array;
  private readonly grantSignature: Uint8Array;

  constructor(params: DeviceLinkGrantMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      primaryDevicePubKey: params.primaryDevicePubKey,
      secondaryDevicePubKey: params.secondaryDevicePubKey,
      requestSignature: params.requestSignature,
    });

    if (!(params.lokiProfile.profileKey instanceof Uint8Array)) {
      throw new TypeError('profileKey must be of type Uint8Array');
    }
    if (!(params.grantSignature instanceof Uint8Array)) {
      throw new TypeError('grantSignature must be of type Uint8Array');
    }

    this.displayName = params.lokiProfile.displayName;
    this.avatarPointer = params.lokiProfile.avatarPointer;
    this.profileKey = params.lokiProfile.profileKey;
    this.grantSignature = params.grantSignature;
  }

  protected getPairingAuthorisationMessage(): SignalService.PairingAuthorisationMessage {
    return new SignalService.PairingAuthorisationMessage({
      primaryDevicePubKey: this.primaryDevicePubKey,
      secondaryDevicePubKey: this.secondaryDevicePubKey,
      requestSignature: new Uint8Array(this.requestSignature),
      grantSignature: new Uint8Array(this.grantSignature),
    });
  }

  protected getDataMessage(): SignalService.DataMessage | undefined {
    // Send profile name to secondary device and avatarPointer
    const profile = new SignalService.DataMessage.LokiProfile();
    profile.avatar = this.avatarPointer;
    profile.displayName = this.displayName;

    return new SignalService.DataMessage({
      profile,
      profileKey: this.profileKey,
    });
  }
}
