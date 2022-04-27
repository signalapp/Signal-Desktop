import { callUtilsWorker } from '../../../webworker/workers/util_worker_interface';
import { OpenGroupV2Request } from '../open_group_api/opengroupV2/ApiUtil';
import { sendApiV2Request } from '../open_group_api/opengroupV2/OpenGroupAPIV2';
import { parseStatusCodeFromOnionRequest } from '../open_group_api/opengroupV2/OpenGroupAPIV2Parser';

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
};

const FILES_ENDPOINT = 'files';
const RELEASE_VERSION_ENDPOINT = 'session_version';

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
    file: await callUtilsWorker('arrayBufferToStringBase64', fileContent),
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
  fileIdOrCompleteUrl: string
): Promise<ArrayBuffer | null> => {
  let fileId = fileIdOrCompleteUrl;
  if (!fileIdOrCompleteUrl) {
    window?.log?.warn('Empty url to download for file v2');
    return null;
  }

  const newCompleteUrlPrefix = `${fileServerV2URL}/${FILES_ENDPOINT}/`;

  if (fileIdOrCompleteUrl.startsWith(newCompleteUrlPrefix)) {
    fileId = fileId.substr(newCompleteUrlPrefix.length);
  }

  const request: FileServerV2Request = {
    method: 'GET',
    endpoint: `${FILES_ENDPOINT}/${fileId}`,
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
  return callUtilsWorker('fromBase64ToArrayBuffer', base64Data);
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
    rawURL = `${fileServerV2URL}/${request.endpoint}`;
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

/**
 * Fetch the latest desktop release available on github from the fileserver.
 * This call is onion routed and so do not expose our ip to github nor the file server.
 */
export const getLatestDesktopReleaseFileToFsV2 = async (): Promise<string | null> => {
  const queryParams = {
    platform: 'desktop',
  };

  const request: FileServerV2Request = {
    method: 'GET',
    endpoint: RELEASE_VERSION_ENDPOINT,
    queryParams,
  };

  const result = await sendApiV2Request(request);
  const statusCode = parseStatusCodeFromOnionRequest(result);
  if (statusCode !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequest to not have all those levels
  const latestVersionWithV = (result as any)?.result?.result as string | undefined;
  if (!latestVersionWithV) {
    return null;
  }
  return latestVersionWithV;
};
