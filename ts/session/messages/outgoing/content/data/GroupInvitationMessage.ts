import { DataMessage } from './DataMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { Constants } from '../../../..';

interface GroupInvitationMessageParams extends MessageParams {
  serverAddress: string;
  channelId: number;
  serverName: string;
}

export class GroupInvitationMessage extends DataMessage {
  private readonly serverAddress: string;
  private readonly channelId: number;
  private readonly serverName: string;

  constructor(params: GroupInvitationMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.serverAddress = params.serverAddress;
    this.channelId = params.channelId;
    this.serverName = params.serverName;
  }

  public ttl(): number {
    return Constants.TTL_DEFAULT.REGULAR_MESSAGE;
  }

  public dataProto(): SignalService.DataMessage {
    const groupInvitation = new SignalService.DataMessage.GroupInvitation({
      serverAddress: this.serverAddress,
      channelId: this.channelId,
      serverName: this.serverName,
    });

    return new SignalService.DataMessage({
      groupInvitation,
    });
  }
}
