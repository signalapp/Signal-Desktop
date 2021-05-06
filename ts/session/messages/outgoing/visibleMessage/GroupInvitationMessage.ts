import { DataMessage } from '..';
import { Constants } from '../../..';
import { SignalService } from '../../../../protobuf';
import { MessageParams } from '../Message';

interface GroupInvitationMessageParams extends MessageParams {
  serverAddress: string;
  channelId: number;
  serverName: string;
  // if there is an expire timer set for the conversation, we need to set it.
  // otherwise, it will disable the expire timer on the receiving side.
  expireTimer?: number;
}

export class GroupInvitationMessage extends DataMessage {
  private readonly serverAddress: string;
  private readonly channelId: number;
  private readonly serverName: string;
  private readonly expireTimer?: number;

  constructor(params: GroupInvitationMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.serverAddress = params.serverAddress;
    this.channelId = params.channelId;
    this.serverName = params.serverName;
    this.expireTimer = params.expireTimer;
  }

  public dataProto(): SignalService.DataMessage {
    const groupInvitation = new SignalService.DataMessage.GroupInvitation({
      serverAddress: this.serverAddress,
      channelId: this.channelId,
      serverName: this.serverName,
    });

    return new SignalService.DataMessage({
      groupInvitation,
      expireTimer: this.expireTimer,
    });
  }
}
