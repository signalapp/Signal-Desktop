import { SignalService } from '../../../../../../protobuf';
import {
  ClosedGroupMessage,
  ClosedGroupMessageParams,
} from './ClosedGroupMessage';
import { AttachmentPointer } from '../ChatMessage';

export interface ClosedGroupUpdateMessageParams
  extends ClosedGroupMessageParams {
  name: string;
  members?: Array<string>;
  admins?: Array<string>;
  avatar?: AttachmentPointer;
}

export class ClosedGroupUpdateMessage extends ClosedGroupMessage {
  private readonly name: string;
  private readonly members?: Array<string>;
  private readonly admins?: Array<string>;
  private readonly avatar?: AttachmentPointer;

  constructor(params: ClosedGroupUpdateMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
    });
    if (typeof params.name !== 'string') {
      throw new Error('name must be a string');
    }
    if (
      params.members &&
      params.members.length > 0 &&
      typeof params.members[0] !== 'string'
    ) {
      throw new Error('members has not the correct type');
    }
    if (
      params.admins &&
      params.admins.length > 0 &&
      typeof params.admins[0] !== 'string'
    ) {
      throw new Error('admins has not the correct type');
    }

    if (
      params.avatar !== undefined &&
      !(params.avatar instanceof SignalService.AttachmentPointer)
    ) {
      throw new Error('avatar has not the correct type');
    }

    this.name = params.name;
    this.members = params.members;
    this.admins = params.admins;
    this.avatar = params.avatar;
  }

  protected groupContext(): SignalService.GroupContext {
    // use the parent method to fill id correctly
    const groupContext = super.groupContext();

    groupContext.type = SignalService.GroupContext.Type.UPDATE;

    if (this.name) {
      groupContext.name = this.name;
    }
    if (this.members && this.members.length > 0) {
      groupContext.members = this.members;
    }

    if (this.admins && this.admins.length > 0) {
      groupContext.admins = this.admins;
    }

    groupContext.avatar = this.avatar;

    return groupContext;
  }
}
