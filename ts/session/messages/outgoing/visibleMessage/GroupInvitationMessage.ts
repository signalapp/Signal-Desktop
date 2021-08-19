import { DataMessage } from '..';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';

interface GroupInvitationMessageParams extends MessageParams {
  url: string;
  name: string;
  // if there is an expire timer set for the conversation, we need to set it.
  // otherwise, it will disable the expire timer on the receiving side.
  expireTimer?: number;
}

export class GroupInvitationMessage extends DataMessage {
  private readonly url: string;
  private readonly name: string;
  private readonly expireTimer?: number;

  constructor(params: GroupInvitationMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.url = params.url;
    this.name = params.name;
    this.expireTimer = params.expireTimer;
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
