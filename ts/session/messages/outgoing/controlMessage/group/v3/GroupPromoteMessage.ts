import { SignalService } from '../../../../../../protobuf';
import { isEmpty } from 'lodash';
import { GroupMessage, GroupMessageParams } from './GroupMessage';
import { from_hex } from 'libsodium-wrappers-sumo';

export interface GroupPromoteMessageParams extends GroupMessageParams {
  /**
   * hex string of the group private key
   */
  privateKey: string;
}

export class GroupPromoteMessage extends GroupMessage {
  private readonly privateKey: string;

  constructor(params: GroupPromoteMessageParams) {
    super(params);

    if (!params.privateKey || isEmpty(params.privateKey)) {
      throw new Error('privateKey parameter must be set');
    }

    this.privateKey = params.privateKey;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.groupMessage = super.groupMessage();
    dataMessage.groupMessage.promoteMessage = new SignalService.GroupPromoteMessage();
    dataMessage.groupMessage.promoteMessage.privateKey = from_hex(this.privateKey);

    return dataMessage;
  }
}
