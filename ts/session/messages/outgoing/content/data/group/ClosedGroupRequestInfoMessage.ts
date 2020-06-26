import { SignalService } from '../../../../../../protobuf';
import {
  ClosedGroupMessage,
  ClosedGroupMessageParams,
} from './ClosedGroupMessage';

export class ClosedGroupRequestInfoMessage extends ClosedGroupMessage {
  constructor(params: ClosedGroupMessageParams) {
    super({
      timestamp: params.timestamp,
      identifier: params.identifier,
      groupId: params.groupId,
    });
  }

  protected groupContextType(): SignalService.GroupContext.Type {
    return SignalService.GroupContext.Type.REQUEST_INFO;
  }
}
