import os from 'os';
import _ from 'lodash';
import semver from 'semver';

export const isMacOS = () => process.platform === 'darwin';
export const isLinux = () => process.platform === 'linux';
export const isWindows = (minVersion?: string) => {
  const osRelease = os.release();

  if (process.platform !== 'win32') {
    return false;
  }

  return _.isUndefined(minVersion) ? true : semver.gte(osRelease, minVersion);
};
