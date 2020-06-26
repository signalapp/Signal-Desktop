import { SignalService } from '../../../../../../protobuf';
import {
  MediumGroupResponseKeysMessage,
  MediumGroupResponseKeysParams,
} from './MediumGroupResponseKeysMessage';

interface MediumGroupCreateParams extends MediumGroupResponseKeysParams {
  groupSecretKey: Uint8Array;
  members: Array<Uint8Array>;
  admins: Array<string>;
  groupName: string;
}

export abstract class MediumGroupCreateMessage extends MediumGroupResponseKeysMessage {
  public readonly groupSecretKey: Uint8Array;
  public readonly members: Array<Uint8Array>;
  public readonly admins: Array<string>;
  public readonly groupName: string;

  constructor({
    timestamp,
    identifier,
    chainKey,
    keyIdx,
    groupId,
    groupSecretKey,
    members,
    admins,
    groupName,
  }: MediumGroupCreateParams) {
    super({ timestamp, identifier, groupId, chainKey, keyIdx });
    this.groupSecretKey = groupSecretKey;
    this.members = members;
    this.admins = admins;
    this.groupName = groupName;
  }

  protected mediumGroupContext(): SignalService.MediumGroupUpdate {
    const mediumGroupContext = super.mediumGroupContext();

    mediumGroupContext.type = SignalService.MediumGroupUpdate.Type.NEW_GROUP;
    mediumGroupContext.groupSecretKey = this.groupSecretKey;
    mediumGroupContext.members = this.members;
    mediumGroupContext.admins = this.admins;
    mediumGroupContext.groupName = this.groupName;

    return mediumGroupContext;
  }
}
