import { from_string, to_string } from 'libsodium-wrappers-sumo';
import { isString, omit, toNumber } from 'lodash';
import { EncodeV4OnionRequestInfos, SnodeResponseV4 } from '../apis/snode_api/onions';
import { concatUInt8Array } from '../crypto';

export const encodeV4Request = (requestInfo: EncodeV4OnionRequestInfos): Uint8Array => {
  const { body } = requestInfo;

  // the body is appended separately to the request (see below)
  const infoWithoutBody = omit(requestInfo, 'body');

  const requestInfoData = from_string(JSON.stringify(infoWithoutBody));
  const prefixData = from_string(`l${requestInfoData.length}:`);
  const suffixData = from_string('e');
  if (body) {
    const bodyData = body && isString(body) ? from_string(body) : (body as Uint8Array);

    const bodyCountdata = from_string(`${bodyData.length}:`);
    return concatUInt8Array(prefixData, requestInfoData, bodyCountdata, bodyData, suffixData);
  }
  return concatUInt8Array(prefixData, requestInfoData, suffixData);
};

export type DecodedResponseV4 = {
  metadata: {
    code: number;
    headers?: Record<string, string>;
  };
  body: object | null; // might be object, or binary or maybe some other stuff..
  bodyBinary: Uint8Array;
  bodyContentType: string;
};

/**
 * When we do a batch request, we get a list of bodies in the body of the response. This is the type for those bodies
 */
export type DecodedResponseBodiesV4 = Array<any>;

/**
 * Nearly identical to request encoding. 2 string bencoded list.
 * Response differs in that the second body part is always present in a response unlike the requests.
 * 1. First part contains response metadata
 * 2. Second part contains the request body.
 */
const decodeV4Response = (snodeResponse: SnodeResponseV4): DecodedResponseV4 | undefined => {
  const eAscii = 'e'.charCodeAt(0);
  const lAscii = 'l'.charCodeAt(0);
  const colonAscii = ':'.charCodeAt(0);

  // json part will have code: containing response code and headers for http headers (always lower case)
  // 1. read first bit till colon to get the length. Substring the next X amount trailing the colon and that's the metadata.
  // 2. grab the number before the next colon. That's the expected length of the body.
  // 3. Use the content type from the metadata header to handle the body.

  const binary = snodeResponse.bodyBinary;

  if (
    !(
      binary &&
      binary.byteLength &&
      binary[0] === lAscii &&
      binary[binary.byteLength - 1] === eAscii
    )
  ) {
    window?.log?.error(
      'decodeV4Response: response is missing prefix and suffix characters - Dropping response'
    );
    return undefined;
  }

  try {
    const firstDelimitIdx = binary.indexOf(colonAscii);

    const infoLength = toNumber(to_string(binary.slice(1, firstDelimitIdx)));

    const infoStringStartIndex = firstDelimitIdx + 1;
    const infoStringEndIndex = infoStringStartIndex + infoLength;
    const infoJson = JSON.parse(to_string(binary.slice(infoStringStartIndex, infoStringEndIndex)));

    const beforeBodyIndex = binary.indexOf(colonAscii, infoStringEndIndex);
    const bodyLength = toNumber(to_string(binary.slice(infoStringEndIndex, beforeBodyIndex)));
    const bodyBinary = binary.slice(beforeBodyIndex + 1, beforeBodyIndex + (bodyLength + 1));

    const bodyContentType: string = infoJson?.headers['content-type'];
    let bodyParsed: object | null = null;
    switch (bodyContentType) {
      case 'application/json':
        bodyParsed = JSON.parse(to_string(bodyBinary));
        break;
      case 'text/plain; charset=utf-8':
        bodyParsed = { plainText: to_string(bodyBinary) };
        break;
      case 'application/octet-stream':
        break;
      case 'text/html; charset=utf-8':
        try {
          window?.log?.warn(
            'decodeV4Response - received raw body of type "text/html; charset=utf-8": ',
            to_string(bodyBinary)
          );
        } catch (e) {
          window?.log?.warn(
            'decodeV4Response - received raw body of type "text/html; charset=utf-8" but not a string'
          );
        }
        break;
      default:
        window?.log?.warn(
          'decodeV4Response - No or unknown content-type information for response: ',
          bodyContentType
        );
    }

    return {
      metadata: infoJson,
      body: bodyParsed,
      bodyContentType,
      bodyBinary,
    };
  } catch (e) {
    window.log.warn('failed to decodeV4Response:', e.message);
    return undefined;
  }
};

export const OnionV4 = { decodeV4Response };
