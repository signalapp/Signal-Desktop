import { ContentMessage } from '../ContentMessage';
import { SignalService } from '../../../../../protobuf';

export abstract class DataMessage extends ContentMessage {
  public abstract dataProto(): SignalService.DataMessage;

  protected contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
    });
  }
}
