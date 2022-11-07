import { SignalService } from '../../../../../../protobuf';
import { isEmpty, isString } from 'lodash';
import { GroupMessage, GroupMessageParams } from './GroupMessage';
import { PubKey } from '../../../../../types';
import { from_hex } from 'libsodium-wrappers-sumo';

export interface GroupInviteMessageParams extends GroupMessageParams {
  name: string;
  /**
   * hex string of that member private key
   */
  memberPrivateKey: string;
}

export class GroupInviteMessage extends GroupMessage {
  private readonly name: string;
  private readonly memberPrivateKey: string;

  constructor(params: GroupInviteMessageParams) {
    super(params);

    if (!params.name || isEmpty(params.name) || !isString(params.name)) {
      throw new Error('name parameter must be valid');
    }

    if (
      !params.memberPrivateKey ||
      isEmpty(params.memberPrivateKey) ||
      !isString(params.memberPrivateKey) ||
      !PubKey.isHexOnly(params.memberPrivateKey)
    ) {
      throw new Error('memberPrivateKey parameter must be valid');
    }

    this.name = params.name;
    this.memberPrivateKey = params.memberPrivateKey;
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.groupMessage = super.groupMessage();
    dataMessage.groupMessage.inviteMessage = new SignalService.GroupInviteMessage();
    dataMessage.groupMessage.inviteMessage.name = this.name;
    dataMessage.groupMessage.inviteMessage.memberPrivateKey = from_hex(this.memberPrivateKey);

    return dataMessage;
  }
}
