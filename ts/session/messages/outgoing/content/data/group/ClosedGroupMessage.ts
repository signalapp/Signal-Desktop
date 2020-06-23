import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { TextEncoder } from 'util';
import { MessageParams } from '../../../Message';
import { PubKey } from '../../../../../types';

interface ClosedGroupMessageParams extends MessageParams {
  groupId: string | PubKey;
}

export abstract class ClosedGroupMessage extends DataMessage {
  public readonly groupId: PubKey;

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
    const { groupId } = params;
    this.groupId = typeof groupId === 'string' ? new PubKey(groupId) : groupId;
  }

  protected abstract groupContextType(): SignalService.GroupContext.Type;

  protected groupContext(): SignalService.GroupContext {
    const id = new TextEncoder().encode(this.groupId.key);
    const type = this.groupContextType();

    return new SignalService.GroupContext({ id, type });
  }

  protected dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.group = this.groupContext();

    return dataMessage;
  }
}
