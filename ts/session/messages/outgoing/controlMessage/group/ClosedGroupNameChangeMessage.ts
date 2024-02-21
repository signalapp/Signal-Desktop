import { SignalService } from '../../../../../protobuf';
import { ClosedGroupMessage, ClosedGroupMessageParams } from './ClosedGroupMessage';

interface ClosedGroupNameChangeMessageParams extends ClosedGroupMessageParams {
  name: string;
}

export class ClosedGroupNameChangeMessage extends ClosedGroupMessage {
  private readonly name: string;

  constructor(params: ClosedGroupNameChangeMessageParams) {
    super(params);
    this.name = params.name;
    if (this.name.length === 0) {
      throw new Error('name cannot be empty');
    }
  }

  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.closedGroupControlMessage!.type =
      SignalService.DataMessage.ClosedGroupControlMessage.Type.NAME_CHANGE;
    dataMessage.closedGroupControlMessage!.name = this.name;

    return dataMessage;
  }
}
