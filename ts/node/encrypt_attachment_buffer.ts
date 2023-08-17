import { getSodiumNode } from './sodiumNode';

export async function decryptAttachmentBufferNode(
  encryptingKey: Uint8Array,
  bufferIn: ArrayBuffer,
  getSodiumOverride?: () => Promise<any>
) {
  const sodium = getSodiumOverride ? await getSodiumOverride() : await getSodiumNode();

  const header = new Uint8Array(
    bufferIn.slice(0, sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );

  const encryptedBuffer = new Uint8Array(
    bufferIn.slice(sodium.crypto_secretstream_xchacha20poly1305_HEADERBYTES)
  );
  try {
    /* Decrypt the stream: initializes the state, using the key and a header */
    const state = sodium.crypto_secretstream_xchacha20poly1305_init_pull(header, encryptingKey);
    // what if ^ this call fail (? try to load as a unencrypted attachment?)

    const messageTag = sodium.crypto_secretstream_xchacha20poly1305_pull(state, encryptedBuffer);
    // we expect the final tag to be there. If not, we might have an issue with this file
    // maybe not encrypted locally?
    if (messageTag.tag === sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL) {
      return messageTag.message;
    }
  } catch (e) {
    console.error('Failed to load the file as an encrypted one', e);
  }
  return new Uint8Array();
}

export async function encryptAttachmentBufferNode(
  encryptingKey: Uint8Array,
  bufferIn: ArrayBuffer,
  getSodiumOverride?: () => Promise<any>
) {
  const sodium = getSodiumOverride ? await getSodiumOverride() : await getSodiumNode();

  try {
    const uintArrayIn = new Uint8Array(bufferIn);

    /* Set up a new stream: initialize the state and create the header */
    const { state, header } = sodium.crypto_secretstream_xchacha20poly1305_init_push(encryptingKey);
    /* Now, encrypt the buffer. */
    const bufferOut = sodium.crypto_secretstream_xchacha20poly1305_push(
      state,
      uintArrayIn,
      null,
      sodium.crypto_secretstream_xchacha20poly1305_TAG_FINAL
    );

    const encryptedBufferWithHeader = new Uint8Array(bufferOut.length + header.length);
    encryptedBufferWithHeader.set(header);
    encryptedBufferWithHeader.set(bufferOut, header.length);

    return { encryptedBufferWithHeader, header };
  } catch (e) {
    console.error('encryptAttachmentBuffer error: ', e);

    return null;
  }
}
