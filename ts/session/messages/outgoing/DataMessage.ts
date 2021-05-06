import { ContentMessage } from '.';
import { SignalService } from '../../../protobuf';
import { TTL_DEFAULT } from '../../constants';

export abstract class DataMessage extends ContentMessage {
  public abstract dataProto(): SignalService.DataMessage;

  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
    });
  }

  public ttl(): number {
    return TTL_DEFAULT.REGULAR_MESSAGE;
  }
}
