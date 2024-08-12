import { SignalService } from '../../../../protobuf';
import { LokiProfile } from '../../../../types/message';
import { ContentMessage } from '../ContentMessage';
import { MessageParams } from '../Message';
import { buildProfileForOutgoingMessage } from '../visibleMessage/VisibleMessage';

// Note: a MessageRequestResponse message should not expire at all on the recipient side/nor our side.
export interface MessageRequestResponseParams extends MessageParams {
  lokiProfile?: LokiProfile;
}

export class MessageRequestResponse extends ContentMessage {
  // we actually send a response only if it is an accept
  // private readonly isApproved: boolean;
  private readonly profileKey?: Uint8Array;
  private readonly profile?: SignalService.DataMessage.ILokiProfile;

  constructor(params: MessageRequestResponseParams) {
    super({
      timestamp: params.timestamp,
    } as MessageRequestResponseParams);

    const profile = buildProfileForOutgoingMessage(params);
    this.profile = profile.lokiProfile;
    this.profileKey = profile.profileKey;
  }

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      messageRequestResponse: this.messageRequestResponseProto(),
    });
  }

  public messageRequestResponseProto(): SignalService.MessageRequestResponse {
    return new SignalService.MessageRequestResponse({
      isApproved: true,
      profileKey: this.profileKey?.length ? this.profileKey : undefined,
      profile: this.profile,
    });
  }
}
