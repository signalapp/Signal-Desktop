import { SignalService } from '../../../../../protobuf';
import { fromHexToArray } from '../../../../utils/String';
import { ClosedGroupEncryptionPairMessage } from './ClosedGroupEncryptionPairMessage';

/**
 * On Desktop, we need separate class for message being sent to a closed group or a private chat.
 *
 * This is because we use the class of the message to know what encryption to use.
 * See toRawMessage();
 *
 * This class is just used to let us send the encryption key par after we receivied a ENCRYPTION_KEYPAIR_REQUEST
 *  from a member of a group.
 * This reply must be sent to this user's pubkey, and so be encoded using sessionProtocol.
 */
export class ClosedGroupEncryptionPairReplyMessage extends ClosedGroupEncryptionPairMessage {
  public dataProto(): SignalService.DataMessage {
    const dataMessage = super.dataProto();

    dataMessage.closedGroupControlMessage!.publicKey = fromHexToArray(this.groupId.key);

    return dataMessage;
  }
}
