import is from '@sindresorhus/is';
import os from 'os';
import semver from 'semver';

export const isMacOS = () => process.platform === 'darwin';
export const isLinux = () => process.platform === 'linux';
export const isWindows = (minVersion?: string) => {
  const isPlatformValid = process.platform === 'win32';
  const osRelease = os.release();
  const isVersionValid = is.undefined(minVersion)
    ? true
    : semver.gte(osRelease, minVersion);

  return isPlatformValid && isVersionValid;
};
