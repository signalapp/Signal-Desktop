import { SignalService } from '../../../../protobuf';
import { VisibleMessage, VisibleMessageParams } from './VisibleMessage';

interface GroupInvitationMessageParams extends VisibleMessageParams {
  url: string;
  name: string;
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
      ...super.dataProto(),
      openGroupInvitation,
    });
  }
}
