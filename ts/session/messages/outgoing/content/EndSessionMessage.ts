import { SessionRequestMessage } from './SessionRequestMessage';
import { SignalService } from '../../../../protobuf';
import { Constants } from '../../..';

export class EndSessionMessage extends SessionRequestMessage {
  public ttl(): number {
    return Constants.TTL_DEFAULT.END_SESSION_MESSAGE;
  }

  protected contentProto(): SignalService.Content {
    const dataMessage = new SignalService.DataMessage({
      body: 'TERMINATE',
      flags: SignalService.DataMessage.Flags.END_SESSION,
    });
    const preKeyBundleMessage = this.getPreKeyBundleMessage();

    return new SignalService.Content({
      dataMessage,
      preKeyBundleMessage,
    });
  }
}
