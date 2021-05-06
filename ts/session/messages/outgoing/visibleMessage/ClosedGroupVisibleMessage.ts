import { Constants } from '../../..';
import { SignalService } from '../../../../protobuf';
import { PubKey } from '../../../types';
import { StringUtils } from '../../../utils';
import { VisibleMessage } from './VisibleMessage';
import { ClosedGroupMessage } from '../controlMessage/group/ClosedGroupMessage';

interface ClosedGroupVisibleMessageParams {
  identifier?: string;
  groupId: string | PubKey;
  chatMessage: VisibleMessage;
}

export class ClosedGroupVisibleMessage extends ClosedGroupMessage {
  private readonly chatMessage: VisibleMessage;

  constructor(params: ClosedGroupVisibleMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier ?? params.chatMessage.identifier,
      groupId: params.groupId,
      expireTimer: params.chatMessage.expireTimer || 0,
    });
    this.chatMessage = params.chatMessage;
  }
  public dataProto(): SignalService.DataMessage {
    const dataProto = this.chatMessage.dataProto();

    if (this.groupId) {
      const groupMessage = new SignalService.GroupContext();
      const groupIdWithPrefix = PubKey.addTextSecurePrefixIfNeeded(this.groupId.key);
      const encoded = StringUtils.encode(groupIdWithPrefix, 'utf8');
      const id = new Uint8Array(encoded);
      groupMessage.id = id;
      groupMessage.type = SignalService.GroupContext.Type.DELIVER;

      dataProto.group = groupMessage;
    }

    return dataProto;
  }
}
