import Long from 'long';
import { SignalService } from '../../../protobuf';

type IncomingMessageAvailableTypes =
  | SignalService.DataMessage
  | SignalService.CallMessage
  | SignalService.ReceiptMessage
  | SignalService.TypingMessage
  | SignalService.ConfigurationMessage
  | SignalService.DataExtractionNotification
  | SignalService.Unsend
  | SignalService.MessageRequestResponse
  | SignalService.ISharedConfigMessage;

export class IncomingMessage<T extends IncomingMessageAvailableTypes> {
  public readonly envelopeTimestamp: number;
  public readonly authorOrGroupPubkey: any;
  public readonly authorInGroup: string | null;
  public readonly messageHash: string;
  public readonly message: T;

  /**
   *
   * - `messageHash` is the hash as retrieved from the `/receive` request
   * - `envelopeTimestamp` is part of the message envelope and the what our sent timestamp must be.
   * - `authorOrGroupPubkey`:
   *      * for a 1o1 message, the is the sender
   *      * for a message in a group, this is the pubkey of the group (as everyone
   *            in a group send message to the group pubkey)
   * - `authorInGroup` is only set when this message is incoming
   *    from a closed group. This is the old `senderIdentity` and
   *    is the publicKey of the sender inside the message itself once
   *    decrypted. This is the real sender of a closed group message.
   * - `message` is the data of the ContentMessage itself.
   */
  constructor({
    envelopeTimestamp,
    authorOrGroupPubkey,
    authorInGroup,
    message,
    messageHash,
  }: {
    messageHash: string;
    envelopeTimestamp: Long;
    authorOrGroupPubkey: string;
    authorInGroup: string | null;
    message: T;
  }) {
    if (envelopeTimestamp > Long.fromNumber(Number.MAX_SAFE_INTEGER)) {
      throw new Error('envelopeTimestamp as Long is > Number.MAX_SAFE_INTEGER');
    }

    this.envelopeTimestamp = envelopeTimestamp.toNumber();
    this.authorOrGroupPubkey = authorOrGroupPubkey;
    this.authorInGroup = authorInGroup;
    this.messageHash = messageHash;
    this.message = message;
  }
}
