// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { copyFileSync } from 'node:fs';

const BASE_BOWER = join(__dirname, '../../components');

// Copy

console.log();
console.log('Copying...');

const BASE_JS = join(__dirname, '../../js');
const COPY_SOURCES = [
  {
    src: join(BASE_BOWER, 'mp3lameencoder/lib/Mp3LameEncoder.js'),
    dest: join(BASE_JS, 'Mp3LameEncoder.min.js'),
  },
  {
    src: join(BASE_BOWER, 'webaudiorecorder/lib/WebAudioRecorderMp3.js'),
    dest: join(BASE_JS, 'WebAudioRecorderMp3.js'),
  },
];

for (const { src, dest } of COPY_SOURCES) {
  console.log(`Copying ${src} to ${dest}`);
  copyFileSync(src, dest);
}
