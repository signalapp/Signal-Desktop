import { SettingsKey } from '../../../../data/settings-key';
import { SignalService } from '../../../../protobuf';
import { Storage } from '../../../../util/storage';
import { VisibleMessage, VisibleMessageParams } from './VisibleMessage';

// eslint-disable-next-line @typescript-eslint/ban-types
export type OpenGroupVisibleMessageParams = VisibleMessageParams & {};

export class OpenGroupVisibleMessage extends VisibleMessage {
  private readonly blocksCommunityMessageRequests: boolean;

  constructor(params: OpenGroupVisibleMessageParams) {
    super(params);
    // they are the opposite of each others
    this.blocksCommunityMessageRequests = !Storage.get(SettingsKey.hasBlindedMsgRequestsEnabled);
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.blocksCommunityMessageRequests = this.blocksCommunityMessageRequests;

    return dataMessage;
  }
}
