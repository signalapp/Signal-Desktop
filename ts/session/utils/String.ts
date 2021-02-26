import ByteBuffer from 'bytebuffer';

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

/**
 * Typescript which can be used to filter out undefined or null values from an array.
 * And making typescript realize that there is no nullish value in the type anymore.
 * @param v the value to evaluate
 */
export function nonNullish<V>(v: V): v is NonNullable<V> {
  return v !== undefined && v !== null;
}

export const toHex = (d: BufferType) => decode(d, 'hex');
export const fromHex = (d: string) => encode(d, 'hex');

export const fromHexToArray = (d: string) => new Uint8Array(encode(d, 'hex'));

export const fromBase64ToArrayBuffer = (d: string) => encode(d, 'base64');
export const fromBase64ToArray = (d: string) =>
  new Uint8Array(encode(d, 'base64'));

export const fromArrayBufferToBase64 = (d: BufferType) => decode(d, 'base64');
