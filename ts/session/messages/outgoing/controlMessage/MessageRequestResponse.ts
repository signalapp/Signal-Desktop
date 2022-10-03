import ByteBuffer from 'bytebuffer';
import { isEmpty } from 'lodash';
import { SignalService } from '../../../../protobuf';
import { LokiProfile } from '../../../../types/Message';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';

// tslint:disable-next-line: no-empty-interface
export interface MessageRequestResponseParams extends MessageParams {
  lokiProfile?: LokiProfile;
}

export class MessageRequestResponse extends ContentMessage {
  // we actually send a response only if it is an accept
  // private readonly isApproved: boolean;
  private readonly profileKey?: Uint8Array;
  private readonly displayName?: string;
  private readonly avatarPointer?: string;

  constructor(params: MessageRequestResponseParams) {
    super({
      timestamp: params.timestamp,
    } as MessageRequestResponseParams);

    if (params.lokiProfile && params.lokiProfile.profileKey) {
      if (
        params.lokiProfile.profileKey instanceof Uint8Array ||
        (params.lokiProfile.profileKey as any) instanceof ByteBuffer
      ) {
        this.profileKey = new Uint8Array(params.lokiProfile.profileKey);
      } else {
        this.profileKey = new Uint8Array(
          ByteBuffer.wrap(params.lokiProfile.profileKey).toArrayBuffer()
        );
      }
    }

    this.displayName = params.lokiProfile && params.lokiProfile.displayName;

    // no need to iclude the avatarPointer if there is no profileKey associated with it.
    this.avatarPointer =
      params.lokiProfile?.avatarPointer && !isEmpty(this.profileKey)
        ? params.lokiProfile.avatarPointer
        : undefined;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      messageRequestResponse: this.messageRequestResponseProto(),
    });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    let profileKey: Uint8Array | undefined;
    let profile: SignalService.DataMessage.LokiProfile | undefined;
    if (this.avatarPointer || this.displayName) {
      profile = new SignalService.DataMessage.LokiProfile();

      if (this.avatarPointer) {
        profile.profilePicture = this.avatarPointer;
      }

      if (this.displayName) {
        profile.displayName = this.displayName;
      }
    }

    if (this.profileKey && this.profileKey.length) {
      profileKey = this.profileKey;
    }
    return new SignalService.MessageRequestResponse({
      isApproved: true,
      profileKey,
      profile,
    });
  }
}
