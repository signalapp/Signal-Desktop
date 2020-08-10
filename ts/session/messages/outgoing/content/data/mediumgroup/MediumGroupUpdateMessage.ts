import { SignalService } from '../../../../../../protobuf';
import {
  MediumGroupMessage,
  MediumGroupMessageParams,
} from './MediumGroupMessage';
import { RatchetState } from '../../../../../medium_group/senderKeys';

interface MediumGroupUpdateParams extends MediumGroupMessageParams {
  members: Array<Uint8Array>;
  admins: Array<Uint8Array>;
  groupName: string;
  senderKeys: Array<RatchetState>; // sender keys for new members only
}

export class MediumGroupUpdateMessage extends MediumGroupMessage {
  public readonly members: Array<Uint8Array>;
  public readonly admins: Array<Uint8Array>;
  public readonly groupName: string;
  public readonly senderKeys: Array<RatchetState>;

  constructor({
    timestamp,
    identifier,
    groupId,
    members,
    admins,
    groupName,
    senderKeys,
  }: MediumGroupUpdateParams) {
    super({ timestamp, identifier, groupId });
    this.members = members;
    this.admins = admins;
    this.groupName = groupName;
    this.senderKeys = senderKeys;
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    const senderKeys = this.senderKeys.map(sk => {
      return {
        chainKey: sk.chainKey,
        keyIndex: sk.keyIdx,
        publicKey: sk.pubKey,
      };
    });

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.INFO;
    mediumGroupContext.members = this.members;
    mediumGroupContext.admins = this.admins;
    mediumGroupContext.name = this.groupName;
    mediumGroupContext.senderKeys = senderKeys;

    return mediumGroupContext;
  }
}
