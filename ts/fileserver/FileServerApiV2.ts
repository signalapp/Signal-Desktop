import { OpenGroupV2Request } from '../opengroup/opengroupV2/ApiUtil';
import { sendApiV2Request } from '../opengroup/opengroupV2/OpenGroupAPIV2';
import { parseStatusCodeFromOnionRequest } from '../opengroup/opengroupV2/OpenGroupAPIV2Parser';
import { fromArrayBufferToBase64, fromBase64ToArrayBuffer } from '../session/utils/String';

// tslint:disable-next-line: no-http-string
export const oldFileServerV2URL = 'http://88.99.175.227';
export const oldFileServerV2PubKey =
  '7cb31905b55cd5580c686911debf672577b3fb0bff81df4ce2d5c4cb3a7aaa69';
// tslint:disable-next-line: no-http-string
export const fileServerV2URL = 'http://filev2.getsession.org';

export const fileServerV2PubKey =
  'da21e1d886c6fbaea313f75298bd64aab03a97ce985b46bb2dad9f2089c8ee59';

export type FileServerV2Request = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  endpoint: string;
  // queryParams are used for post or get, but not the same way
  queryParams?: Record<string, any>;
  headers?: Record<string, string>;
  isOldV2server?: boolean; // to remove in a few days
};

const FILES_ENDPOINT = 'files';

// Disable this if you don't want to use the file server v2 for sending
// Receiving is always enabled if the attachments url matches a fsv2 url
export const useFileServerAPIV2Sending = true;

/**
 * Upload a file to the file server v2
 * @param fileContent the data to send
 * @returns null or the fileID and complete URL to share this file
 */
export const uploadFileToFsV2 = async (
  fileContent: ArrayBuffer
): Promise<{ fileId: number; fileUrl: string } | null> => {
  if (!fileContent || !fileContent.byteLength) {
    return null;
  }
  const queryParams = {
    file: fromArrayBufferToBase64(fileContent),
  };

  const request: FileServerV2Request = {
    method: 'POST',
    endpoint: FILES_ENDPOINT,
    queryParams,
  };

  const result = await sendApiV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const fileId = (result as any)?.result?.result as number | undefined;
  if (!fileId) {
    return null;
  }
  const fileUrl = `${fileServerV2URL}/${FILES_ENDPOINT}/${fileId}`;
  return {
    fileId: fileId,
    fileUrl,
  };
};

/**
 * Download a file given the fileId from the fileserver v2
 * @param fileIdOrCompleteUrl the fileId to download or the completeUrl to the fileitself
 * @returns the data as an Uint8Array or null
 */
export const downloadFileFromFSv2 = async (
  fileIdOrCompleteUrl: string,
  isOldV2server: boolean
): Promise<ArrayBuffer | null> => {
  let fileId = fileIdOrCompleteUrl;
  if (!fileIdOrCompleteUrl) {
    window.log.warn('Empty url to download for file v2');
    return null;
  }

  const oldCompleteUrlPrefix = `${oldFileServerV2URL}/${FILES_ENDPOINT}/`;
  const newCompleteUrlPrefix = `${fileServerV2URL}/${FILES_ENDPOINT}/`;

  if (fileIdOrCompleteUrl.startsWith(newCompleteUrlPrefix)) {
    fileId = fileId.substr(newCompleteUrlPrefix.length);
  } else if (fileIdOrCompleteUrl.startsWith(oldCompleteUrlPrefix)) {
    fileId = fileId.substr(oldCompleteUrlPrefix.length);
  }

  const request: FileServerV2Request = {
    method: 'GET',
    endpoint: `${FILES_ENDPOINT}/${fileId}`,
    isOldV2server,
  };

  const result = await sendApiV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const base64Data = (result as any)?.result?.result as string | undefined;

  if (!base64Data) {
    return null;
  }
  return fromBase64ToArrayBuffer(base64Data);
};

/**
 * This is a typescript type guard
 * request.isAuthRequired Must be set for an OpenGroupV2Request
 * @returns true if request.isAuthRequired is not undefined
 */
export function isOpenGroupV2Request(
  request: FileServerV2Request | OpenGroupV2Request
): request is OpenGroupV2Request {
  return (request as OpenGroupV2Request).isAuthRequired !== undefined;
}

/**
 * Try to build an full url and check it for validity.
 * @returns null if the check failed. the built URL otherwise
 */
export const buildUrl = (request: FileServerV2Request | OpenGroupV2Request): URL | null => {
  let rawURL: string;
  if (isOpenGroupV2Request(request)) {
    rawURL = `${request.server}/${request.endpoint}`;
  } else {
    if (request.isOldV2server) {
      rawURL = `${oldFileServerV2URL}/${request.endpoint}`;
    } else {
      rawURL = `${fileServerV2URL}/${request.endpoint}`;
    }
  }

  if (request.method === 'GET') {
    const entries = Object.entries(request.queryParams || {});

    if (entries.length) {
      const queryString = entries.map(([key, value]) => `${key}=${value}`).join('&');
      rawURL += `?${queryString}`;
    }
  }
  // this just check that the URL is valid
  try {
    return new URL(`${rawURL}`);
  } catch (error) {
    return null;
  }
};
