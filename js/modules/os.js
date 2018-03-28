/* eslint-env node */

exports.isMacOS = () =>
  process.platform === 'darwin';

exports.isLinux = () =>
  process.platform === 'linux';

exports.isWindows = () =>
  process.platform === 'win32';
