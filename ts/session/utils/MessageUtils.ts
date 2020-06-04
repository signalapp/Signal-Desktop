import { RawMessage } from '../types/RawMessage';
import { ContentMessage } from '../messages/outgoing';
import { EncryptionType } from '../types/EncryptionType';
import * as crypto from 'crypto';

function toRawMessage(device: PubKey, message: ContentMessage): RawMessage {
  const ttl = message.ttl();
  const timestamp = message.timestamp;
  const plainTextBuffer = message.plainTextBuffer();

  // Get EncryptionType depending on message type.
  // let encryption: EncryptionType;

  // switch (message.constructor.name) {
  //   case MessageType.Chat:
  //     encryption = EncryptionType.Signal;
  //     break;
  //   case MessageType.SessionReset:
  //     encryption = EncryptionType
  // }

  // export enum EncryptionType {
  //   Signal,
  //   SessionReset,
  //   MediumGroup,
  // }

  // tslint:disable-next-line: no-unnecessary-local-variable
  const rawMessage: RawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    timestamp,
    device: device.key,
    ttl,
    encryption: EncryptionType.Signal,
  };

  return rawMessage;
}

export enum PubKeyType {
  Primary = 'priamry',
  Secondary = 'secondary',
  Group = 'group',
}

export class PubKey {
  private static readonly regex: string = '^0[0-9a-fA-F]{65}$';
  public readonly key: string;
  public type?: PubKeyType;

  constructor(pubkeyString: string, type?: PubKeyType) {
    PubKey.validate(pubkeyString);
    this.key = pubkeyString;
    this.type = type;
  }

  public static from(pubkeyString: string): PubKey {
    // Returns a new instance if the pubkey is valid
    if (PubKey.validate(pubkeyString)) {
      return new PubKey(pubkeyString);
    }

    throw new Error('Invalid pubkey format');
  }

  public static validate(pubkeyString: string): boolean {
    if (pubkeyString.match(PubKey.regex)) {
      return true;
    }

    throw new Error('Invalid pubkey format');
  }

  public static generate(): PubKey {
    // Generates a mock pubkey for testing
    const PUBKEY_LEN = 66;
    const numBytes = PUBKEY_LEN / 2;
    const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
    const pubkeyString = `0${hexBuffer}`.slice(0, PUBKEY_LEN);

    return new PubKey(pubkeyString);
  }
}

// Functions / Tools
export const MessageUtils = {
  toRawMessage,
};
