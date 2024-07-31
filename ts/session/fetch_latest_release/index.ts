// every 1 minute we fetch from the fileserver to check for a new release
// * if there is none, no request to github are made.
// * if there is a version on the fileserver more recent than our current, we fetch github to get the UpdateInfos and trigger an update as usual (asking user via dialog)

import { isEmpty, isString } from 'lodash';
import { ipcRenderer } from 'electron';
import { DURATION } from '../constants';
import { getLatestReleaseFromFileServer } from '../apis/file_server_api/FileServerApi';

/**
 * We don't want to hit the fileserver too often. Only often on start, and then every 30 minutes
 */
const skipIfLessThan = DURATION.MINUTES * 30;

let lastFetchedTimestamp = Number.MIN_SAFE_INTEGER;

function resetForTesting() {
  lastFetchedTimestamp = Number.MIN_SAFE_INTEGER;
}

async function fetchReleaseFromFSAndUpdateMain(userEd25519SecretKey: Uint8Array) {
  try {
    window.log.info('[updater] about to fetchReleaseFromFSAndUpdateMain');
    const diff = Date.now() - lastFetchedTimestamp;
    if (diff < skipIfLessThan) {
      window.log.info(
        `[updater] fetched release from fs ${Math.floor(diff / DURATION.MINUTES)}minutes ago, skipping until that's at least ${Math.floor(skipIfLessThan / DURATION.MINUTES)}`
      );
      return;
    }

    const justFetched = await getLatestReleaseFromFileServer(userEd25519SecretKey);
    window.log.info('[updater] fetched latest release from fileserver: ', justFetched);

    if (isString(justFetched) && !isEmpty(justFetched)) {
      lastFetchedTimestamp = Date.now();
      ipcRenderer.send('set-release-from-file-server', justFetched);
      window.readyForUpdates();
    }
  } catch (e) {
    window.log.warn(e);
  }
}

export const fetchLatestRelease = {
  /**
   * Try to fetch the latest release from the fileserver every 1 minute.
   * If we did fetch a release already in the last 30 minutes, we will skip the call.
   */
  fetchReleaseFromFileServerInterval: DURATION.MINUTES * 1,
  fetchReleaseFromFSAndUpdateMain,
  resetForTesting,
};
