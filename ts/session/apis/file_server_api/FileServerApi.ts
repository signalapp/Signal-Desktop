import AbortController from 'abort-controller';
import { OnionSending, OnionV4JSONSnodeResponse } from '../../onions/onionSend';
import {
  batchGlobalIsSuccess,
  parseBatchGlobalStatusCode,
} from '../open_group_api/sogsv3/sogsV3BatchPoll';

export const fileServerHost = 'filev2.getsession.org';
export const fileServerURL = `http://${fileServerHost}`;

export const fileServerPubKey = 'da21e1d886c6fbaea313f75298bd64aab03a97ce985b46bb2dad9f2089c8ee59';
const RELEASE_VERSION_ENDPOINT = '/session_version?platform=desktop';

const POST_GET_FILE_ENDPOINT = '/file';

/**
 * Upload a file to the file server v2 using the onion v4 encoding
 * @param fileContent the data to send
 * @returns null or the fileID and complete URL to share this file
 */
export const uploadFileToFsWithOnionV4 = async (
  fileContent: ArrayBuffer
): Promise<{ fileId: number; fileUrl: string } | null> => {
  if (!fileContent || !fileContent.byteLength) {
    return null;
  }

  const result = await OnionSending.sendBinaryViaOnionV4ToFileServer({
    abortSignal: new AbortController().signal,
    bodyBinary: new Uint8Array(fileContent),
    endpoint: POST_GET_FILE_ENDPOINT,
    method: 'POST',
  });

  if (!batchGlobalIsSuccess(result)) {
    return null;
  }

  const fileId = result?.body?.id as number | undefined;
  if (!fileId) {
    return null;
  }
  const fileUrl = `${fileServerURL}${POST_GET_FILE_ENDPOINT}/${fileId}`;
  return {
    fileId,
    fileUrl,
  };
};

/**
 * Download a file given the fileId from the fileserver
 * @param fileIdOrCompleteUrl the fileId to download or the completeUrl to the fileitself
 * @returns the data as an Uint8Array or null
 */
export const downloadFileFromFileServer = async (
  fileIdOrCompleteUrl: string
): Promise<ArrayBuffer | null> => {
  let fileId = fileIdOrCompleteUrl;
  if (!fileIdOrCompleteUrl) {
    window?.log?.warn('Empty url to download for fileserver');
    return null;
  }

  if (fileIdOrCompleteUrl.lastIndexOf('/') >= 0) {
    fileId = fileId.substring(fileIdOrCompleteUrl.lastIndexOf('/') + 1);
  }

  if (fileId.startsWith('/')) {
    fileId = fileId.substring(1);
  }

  if (!fileId) {
    window.log.info('downloadFileFromFileServer given empty fileId');
    return null;
  }

  const urlToGet = `${POST_GET_FILE_ENDPOINT}/${fileId}`;
  if (window.sessionFeatureFlags?.debug.debugFileServerRequests) {
    window.log.info(`about to try to download fsv2: "${urlToGet}"`);
  }

  // this throws if we get a 404 from the file server
  const result = await OnionSending.getBinaryViaOnionV4FromFileServer({
    abortSignal: new AbortController().signal,
    endpoint: urlToGet,
    method: 'GET',
    throwError: true,
  });
  if (window.sessionFeatureFlags?.debug.debugFileServerRequests) {
    window.log.info(`download fsv2: "${urlToGet} got result:`, JSON.stringify(result));
  }
  if (!result) {
    return null;
  }

  if (!batchGlobalIsSuccess(result)) {
    window.log.info(
      'download from fileserver failed with status ',
      parseBatchGlobalStatusCode(result)
    );
    return null;
  }

  const { bodyBinary } = result;
  if (!bodyBinary || !bodyBinary.byteLength) {
    window.log.info('download from fileserver failed with status, empty content downloaded ');
    return null;
  }

  return bodyBinary.buffer;
};

const parseStatusCodeFromOnionRequestV4 = (
  onionV4Result: OnionV4JSONSnodeResponse | null
): number | undefined => {
  if (!onionV4Result) {
    return undefined;
  }
  return onionV4Result?.body?.status_code || undefined;
};

/**
 * Fetch the latest desktop release available on github from the fileserver.
 * This call is onion routed and so do not expose our ip to github nor the file server.
 */
export const getLatestReleaseFromFileServer = async (): Promise<string | null> => {
  const result = await OnionSending.sendJsonViaOnionV4ToFileServer({
    abortSignal: new AbortController().signal,
    endpoint: RELEASE_VERSION_ENDPOINT,
    method: 'GET',
    stringifiedBody: null,
  });

  if (!batchGlobalIsSuccess(result) || parseStatusCodeFromOnionRequestV4(result) !== 200) {
    return null;
  }

  // we should probably change the logic of sendOnionRequestNoRetries to not have all those levels
  const latestVersionWithV = (result?.body as any)?.result;
  if (!latestVersionWithV) {
    return null;
  }
  return latestVersionWithV;
};
