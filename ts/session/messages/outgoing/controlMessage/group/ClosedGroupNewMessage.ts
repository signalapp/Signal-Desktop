import { SignalService } from '../../../../../protobuf';
import { ECKeyPair } from '../../../../../receiver/keypairs';
import { fromHexToArray } from '../../../../utils/String';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';

export interface ClosedGroupNewMessageParams extends ClosedGroupMessageParams {
  name: string;
  members: Array<string>;
  admins: Array<string>;
  keypair: ECKeyPair;
  expireTimer: number;
}

export class ClosedGroupNewMessage extends ClosedGroupMessage {
  private readonly name: string;
  private readonly members: Array<string>;
  private readonly admins: Array<string>;
  private readonly keypair: ECKeyPair;

  constructor(params: ClosedGroupNewMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
      expirationType: params.expirationType,
      expireTimer: params.expireTimer,
    });
    this.name = params.name;
    this.members = params.members;
    this.admins = params.admins;
    this.keypair = params.keypair;

    if (!params.admins || params.admins.length === 0) {
      throw new Error('Admins must be set');
    }
    if (!params.members || params.members.length === 0) {
      throw new Error('Members must be set');
    }
    // Assert that every admins is a member
    if (!ClosedGroupMessage.areAdminsMembers(params.admins, params.members)) {
      throw new Error('Admins must all be members of the group');
    }
    if (!params.name || params.name.length === 0) {
      throw new Error('Name must cannot be empty');
    }
    if (
      params.keypair.privateKeyData.byteLength === 0 ||
      params.keypair.publicKeyData.byteLength === 0
    ) {
      throw new Error('PrivKey or pubkey is empty and cannot be');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();

    dataMessage.closedGroupControlMessage =
      new SignalService.DataMessage.ClosedGroupControlMessage();

    dataMessage.closedGroupControlMessage.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.NEW;
    dataMessage.closedGroupControlMessage.publicKey = fromHexToArray(this.groupId.key);
    dataMessage.closedGroupControlMessage.name = this.name;

    dataMessage.closedGroupControlMessage.admins = this.admins.map(fromHexToArray);
    dataMessage.closedGroupControlMessage.members = this.members.map(fromHexToArray);
    dataMessage.closedGroupControlMessage.expirationTimer = this.expireTimer;
    try {
      dataMessage.closedGroupControlMessage.encryptionKeyPair = new SignalService.KeyPair();
      dataMessage.closedGroupControlMessage.encryptionKeyPair.privateKey = new Uint8Array(
        this.keypair.privateKeyData
      );
      dataMessage.closedGroupControlMessage.encryptionKeyPair.publicKey = new Uint8Array(
        this.keypair.publicKeyData
      );
    } catch (e) {
      window?.log?.error('Failed to add encryptionKeyPair to group:', e);
      throw new Error('Failed to add encryptionKeyPair to group:');
    }

    return dataMessage;
  }
}
