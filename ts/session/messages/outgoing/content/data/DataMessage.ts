import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class DataMessage extends ContentMessage {
  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
    });
  }

  protected abstract dataProto(): SignalService.DataMessage;
}
