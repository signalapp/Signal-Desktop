import { DataMessage } from '../DataMessage';
import { SignalService } from '../../../../../../protobuf';
import { TextEncoder } from 'util';
import { MessageParams } from '../../../Message';
import { StringUtils } from '../../../../../utils';

export interface ClosedGroupMessageParams extends MessageParams {
  groupId: string;
}

export abstract class ClosedGroupMessage extends DataMessage {
  public readonly groupId: string;

  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
    this.groupId = params.groupId;
  }

  protected abstract groupContextType(): SignalService.GroupContext.Type;

  protected groupContext(): SignalService.GroupContext {
    const id = new Uint8Array(
      StringUtils.encode(this.groupId, 'utf8')
    );
    const type = this.groupContextType();

    return new SignalService.GroupContext({ id, type });
  }

  protected dataProto(): SignalService.DataMessage {
    const dataMessage = new SignalService.DataMessage();
    dataMessage.group = this.groupContext();

    return dataMessage;
  }
}
