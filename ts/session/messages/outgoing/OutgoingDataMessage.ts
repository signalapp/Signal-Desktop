import { OutgoingContentMessage } from './OutgoingContentMessage';
import { SignalService } from '../../../protobuf';

export class OutgoingDataMessage extends OutgoingContentMessage {
  public contentProto(): SignalService.Content {
    return new SignalService.Content({
      dataMessage: this.dataProto(),
    });
  }

  protected dataProto(): SignalService.DataMessage {
    throw new Error('dataProto() needs to be implemented.');
  }
}
