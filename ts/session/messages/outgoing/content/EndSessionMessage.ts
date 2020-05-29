import { SessionResetMessage } from './SessionResetMessage';
import { SignalService } from '../../../../protobuf';

export class EndSessionMessage extends SessionResetMessage {
  public ttl(): number {
    return 4 * 24 * 60 * 60 * 1000; // 4 days
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
