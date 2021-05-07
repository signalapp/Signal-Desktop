/**
 * Unpad the buffer from its padding.
 * An error is thrown if there is no padding.
 * A padded buffer is
 *  * whatever at start
 *  * ends with 0x80 and any number of 0x00 until the end
 */
export function removeMessagePadding(paddedData: ArrayBuffer): ArrayBuffer {
  const paddedPlaintext = new Uint8Array(paddedData);

  for (let i = paddedPlaintext.length - 1; i >= 0; i -= 1) {
    if (paddedPlaintext[i] === 0x80) {
      const plaintext = new Uint8Array(i);
      plaintext.set(paddedPlaintext.subarray(0, i));
      return plaintext.buffer;
    } else if (paddedPlaintext[i] !== 0x00) {
      throw new Error('Invalid padding');
    }
  }

  throw new Error('Invalid padding');
}

/**
 * Add padding to a message buffer
 * @param messageBuffer The buffer to add padding to.
 */
export function addMessagePadding(messageBuffer: Uint8Array): Uint8Array {
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
