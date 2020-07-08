import { SyncMessage } from './SyncMessage';
import { SignalService } from '../../../../../protobuf';
import { MessageParams } from '../../Message';
import { StringUtils, SyncMessageUtils } from '../../../../utils';

interface RawGroup {
  id: string;
  name: string;
  members: Array<string>;
  blocked: boolean;
  expireTimer?: number;
  admins: Array<string>;
}

interface ClosedGroupSyncMessageParams extends MessageParams {
  rawGroup: RawGroup;
}

export abstract class ClosedGroupSyncMessage extends SyncMessage {
  public readonly id: Uint8Array;
  public readonly name: string;
  public readonly members: Array<string>;
  public readonly blocked: boolean;
  public readonly expireTimer: number | undefined;
  public readonly admins: Array<string>;

  constructor(params: ClosedGroupSyncMessageParams) {
    super({ timestamp: params.timestamp, identifier: params.identifier });
    this.id = new Uint8Array(StringUtils.encode(params.rawGroup.id, 'utf8'));
    this.name = params.rawGroup.name;
    this.members = params.rawGroup.members;
    this.blocked = params.rawGroup.blocked;
    this.expireTimer = params.rawGroup.expireTimer;
    this.admins = params.rawGroup.admins;
  }

  protected syncProto(): SignalService.SyncMessage {
    const syncMessage = super.syncProto();
    const groupDetails = new SignalService.GroupDetails({
      id: this.id,
      name: this.name,
      members: this.members,
      blocked: this.blocked,
      expireTimer: this.expireTimer,
      admins: this.admins,
    });

    const encodedGroupDetails = SignalService.GroupDetails.encode(
      groupDetails
    ).finish();
    const byteBuffer = SyncMessageUtils.serialiseByteBuffers([
      encodedGroupDetails,
    ]);
    const data = new Uint8Array(byteBuffer.toArrayBuffer());
    syncMessage.groups = new SignalService.SyncMessage.Groups({
      data,
    });
    return syncMessage;
  }
}
