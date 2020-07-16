import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';

interface OpenGroupDetails {
  url: string;
  channelId: number;
}

interface OpenGroupSyncMessageParams extends MessageParams {
  openGroupsDetails: [OpenGroupDetails];
}

export abstract class OpenGroupSyncMessage extends SyncMessage {
  public readonly openGroupsDetails: [OpenGroupDetails];

  constructor(params: OpenGroupSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.openGroupsDetails = params.openGroupsDetails;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    syncMessage.openGroups = this.openGroupsDetails.map(openGroup => {
      return new SignalService.SyncMessage.OpenGroupDetails({
        url: openGroup.url.split('@').pop(),
        channelId: openGroup.channelId,
      });
    });

    return syncMessage;
  }
}
