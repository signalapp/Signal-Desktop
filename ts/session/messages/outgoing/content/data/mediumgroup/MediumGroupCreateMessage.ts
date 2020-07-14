import { SignalService } from '../../../../../../protobuf';
import {
  MediumGroupMessage,
  MediumGroupMessageParams,
  RatchetKey,
} from './MediumGroupMessage';

interface MediumGroupCreateParams extends MediumGroupMessageParams {
  groupSecretKey: Uint8Array;
  members: Array<Uint8Array>;
  admins: Array<Uint8Array>;
  groupName: string;
  senderKeys: Array<RatchetKey>;
}

export abstract class MediumGroupCreateMessage extends MediumGroupMessage {
  public readonly groupSecretKey: Uint8Array;
  public readonly members: Array<Uint8Array>;
  public readonly admins: Array<Uint8Array>;
  public readonly groupName: string;
  public readonly senderKeys: Array<RatchetKey>;

  constructor({
    timestamp,
    identifier,
    groupId,
    groupSecretKey,
    members,
    admins,
    groupName,
    senderKeys,
  }: MediumGroupCreateParams) {
    super({ timestamp, identifier, groupId });
    this.groupSecretKey = groupSecretKey;
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

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.NEW;
    mediumGroupContext.groupPrivateKey = this.groupSecretKey;
    mediumGroupContext.members = this.members;
    mediumGroupContext.admins = this.admins;
    mediumGroupContext.name = this.groupName;
    mediumGroupContext.senderKeys = senderKeys;

    return mediumGroupContext;
  }
}
