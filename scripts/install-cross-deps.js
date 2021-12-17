// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const path = require('path');
const { execSync } = require('child_process');

exports.beforeBuild = async () => {
  if (process.platform !== 'darwin') {
    return true;
  }

  const nonNativeArchs = ['arm64', 'x64'].filter(arch => arch !== process.arch);

  for (const arch of nonNativeArchs) {
    console.log("Installing sharp's dependencies for", arch);
    execSync('yarn run install', {
      cwd: path.join(__dirname, '..', 'node_modules', 'sharp'),
      env: {
        ...process.env,
        npm_config_arch: arch,
      },
    });
  }

  // Let electron-builder handle dependencies
  return true;
};
