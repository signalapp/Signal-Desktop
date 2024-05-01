import ByteBuffer from 'bytebuffer';
import { MAX_USERNAME_BYTES } from '../constants';

export type Encoding = 'base64' | 'hex' | 'binary' | 'utf8';
export type BufferType = ByteBuffer | Buffer | ArrayBuffer | Uint8Array;

/**
 * Take a string value with the given encoding and converts it to an `ArrayBuffer`.
 * @param value The string value.
 * @param encoding The encoding of the string value.
 */
export function encode(value: string, encoding: Encoding): ArrayBuffer {
  return ByteBuffer.wrap(value, encoding).toArrayBuffer();
}

/**
 * Take a buffer and convert it to a string with the given encoding.
 * @param buffer The buffer.
 * @param stringEncoding The encoding of the converted string value.
 */
export function decode(buffer: BufferType, stringEncoding: Encoding): string {
  return ByteBuffer.wrap(buffer).toString(stringEncoding);
}

export const toHex = (d: BufferType) => decode(d, 'hex');
export const fromHex = (d: string) => encode(d, 'hex');

export const fromHexToArray = (d: string) => new Uint8Array(fromHex(d));

export const fromBase64ToArrayBuffer = (d: string) => encode(d, 'base64');
export const fromBase64ToArray = (d: string) => new Uint8Array(fromBase64ToArrayBuffer(d));

export const fromArrayBufferToBase64 = (d: BufferType) => decode(d, 'base64');
export const fromUInt8ArrayToBase64 = (d: Uint8Array) => decode(d, 'base64');

export const stringToArrayBuffer = (str: string): ArrayBuffer => {
  if (typeof str !== 'string') {
    throw new TypeError("'string' must be a string");
  }

  return encode(str, 'binary');
};

export const stringToUint8Array = (str?: string): Uint8Array => {
  if (!str) {
    return new Uint8Array();
  }
  return new Uint8Array(stringToArrayBuffer(str));
};

// Regex to match all characters which are forbidden in display names
const forbiddenDisplayCharRegex = /\uFFD2*/g;

/**
 *
 * This function removes any forbidden char from a given display name.
 * This does not trim it as otherwise, a user cannot type User A as when he hits the space, it gets trimmed right away.
 * The trimming should hence happen after calling this and on saving the display name.
 *
 * This functions makes sure that the MAX_USERNAME_BYTES is verified for utf8 byte length
 * @param inputName the input to sanitize
 * @returns a sanitized string, untrimmed
 */
export const sanitizeSessionUsername = (inputName: string) => {
  const validChars = inputName.replace(forbiddenDisplayCharRegex, '');

  const lengthBytes = encode(validChars, 'utf8').byteLength;
  if (lengthBytes > MAX_USERNAME_BYTES) {
    throw new Error('Display name is too long');
  }

  return validChars;
};

export const ed25519Str = (ed25519Key: string) => `(...${ed25519Key.substr(58)})`;
