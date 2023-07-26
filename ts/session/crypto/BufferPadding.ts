import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../constants';

/**
 * This file is used to pad message buffer and attachments
 */
const PADDING_BYTE = 0x00;

/**
 * Unpad the buffer from its padding.
 * An error is thrown if there is no padding.
 * A padded buffer is
 *  * whatever at start
 *  * ends with 0x80 and any number of 0x00 until the end
 */
export function removeMessagePadding(paddedData: ArrayBuffer): ArrayBuffer {
  const paddedPlaintext = new Uint8Array(paddedData);
  // window?.log?.info('Removing message padding...');
  for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
    if (paddedPlaintext[i] === 0x80) {
      const plaintext = new Uint8Array(i);
      plaintext.set(paddedPlaintext.subarray(0, i));
      return plaintext.buffer;
    }
    if (paddedPlaintext[i] !== PADDING_BYTE) {
      // window?.log?.warn('got a message without padding... Letting it through for now');
      return paddedPlaintext;
    }
  }

  throw new Error('Invalid padding');
}

/**
 * Add padding to a message buffer
 * @param messageBuffer The buffer to add padding to.
 */
export function addMessagePadding(messageBuffer: Uint8Array): Uint8Array {
  // window?.log?.info('Adding message padding...');

  const plaintext = new Uint8Array(getPaddedMessageLength(messageBuffer.byteLength + 1) - 1);
  plaintext.set(new Uint8Array(messageBuffer));
  plaintext[messageBuffer.byteLength] = 0x80;

  return plaintext;
}

function getPaddedMessageLength(originalLength: number): number {
  const messageLengthWithTerminator = originalLength + 1;
  let messagePartCount = Math.floor(messageLengthWithTerminator / 160);

  if (messageLengthWithTerminator % 160 !== 0) {
    messagePartCount += 1;
  }

  return messagePartCount * 160;
}

/*
 * If the attachment has padding, remove the padding and return the unpad attachment
 */
export function getUnpaddedAttachment(
  data: ArrayBuffer,
  unpaddedExpectedSize: number
): ArrayBuffer | null {
  // window?.log?.debug('Removing attachment padding...');

  // to have a padding we must have a strictly longer length expected
  if (data.byteLength <= unpaddedExpectedSize) {
    return null;
  }
  // we now consider that anything coming after the expected size is padding, no matter what there is there
  return data.slice(0, unpaddedExpectedSize);
}

export function addAttachmentPadding(data: ArrayBuffer): ArrayBuffer {
  const originalUInt = new Uint8Array(data);
  window?.log?.info('Adding attachment padding...');

  let paddedSize = Math.max(
    541,
    // eslint-disable-next-line prefer-exponentiation-operator, no-restricted-properties
    Math.floor(Math.pow(1.05, Math.ceil(Math.log(originalUInt.length) / Math.log(1.05))))
  );

  if (
    paddedSize > MAX_ATTACHMENT_FILESIZE_BYTES &&
    originalUInt.length <= MAX_ATTACHMENT_FILESIZE_BYTES
  ) {
    paddedSize = MAX_ATTACHMENT_FILESIZE_BYTES;
  }
  const paddedData = new ArrayBuffer(paddedSize);
  const paddedUInt = new Uint8Array(paddedData);

  paddedUInt.fill(PADDING_BYTE, originalUInt.length);
  paddedUInt.set(originalUInt);

  return paddedUInt.buffer;
}
