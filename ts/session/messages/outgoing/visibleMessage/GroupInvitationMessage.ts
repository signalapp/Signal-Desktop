import { SignalService } from '../../../../protobuf';
import { DisappearingMessageType } from '../../../../util/expiringMessages';
import { MessageParams } from '../Message';
import { VisibleMessage } from './VisibleMessage';

interface GroupInvitationMessageParams extends MessageParams {
  url: string;
  name: string;
  // if disappearing messages is set for the conversation, we need to set it.
  // otherwise, it will disable the expire timer on the receiving side.
  expirationType?: DisappearingMessageType;
  expireTimer?: number;
}

export class GroupInvitationMessage extends VisibleMessage {
  private readonly url: string;
  private readonly name: string;

  constructor(params: GroupInvitationMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });
    this.url = params.url;
    this.name = params.name;
  }

  public dataProto(): SignalService.DataMessage {
    const openGroupInvitation = new SignalService.DataMessage.OpenGroupInvitation({
      url: this.url,
      name: this.name,
    });

    return new SignalService.DataMessage({
      openGroupInvitation,
      expireTimer: this.expireTimer,
    });
  }
}
