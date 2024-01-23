import { SignalService } from '../../../../protobuf';
import { PubKey } from '../../../types';
import { StringUtils } from '../../../utils';
import {
  ClosedGroupMessage,
  ClosedGroupMessageParams,
} from '../controlMessage/group/ClosedGroupMessage';
import { VisibleMessage } from './VisibleMessage';

interface ClosedGroupVisibleMessageParams
  extends Omit<ClosedGroupMessageParams, 'expireTimer' | 'expirationType'> {
  groupId: PubKey;
  chatMessage: VisibleMessage;
}

export class ClosedGroupVisibleMessage extends ClosedGroupMessage {
  private readonly chatMessage: VisibleMessage;

  constructor(params: ClosedGroupVisibleMessageParams) {
    super({
      timestamp: params.chatMessage.timestamp,
      identifier: params.identifier ?? params.chatMessage.identifier,
      groupId: params.groupId,
      expirationType: params.chatMessage.expirationType,
      expireTimer: params.chatMessage.expireTimer,
    });

    this.chatMessage = params.chatMessage;

    if (!params.groupId) {
      throw new Error('ClosedGroupVisibleMessage: groupId must be set');
    }

    if (PubKey.isClosedGroupV3(PubKey.cast(params.groupId).key)) {
      throw new Error('GroupContext should not be used anymore with closed group v3');
    }
  }

  public dataProto(): SignalService.DataMessage {
    // expireTimer is set in the dataProto in this call directly
    const dataProto = this.chatMessage.dataProto();

    const groupMessage = new SignalService.GroupContext();

    const groupIdWithPrefix = PubKey.addTextSecurePrefixIfNeeded(this.groupId.key);
    const encoded = StringUtils.encode(groupIdWithPrefix, 'utf8');
    const id = new Uint8Array(encoded);
    groupMessage.id = id;
    groupMessage.type = SignalService.GroupContext.Type.DELIVER;

    dataProto.group = groupMessage;

    return dataProto;
  }
}
