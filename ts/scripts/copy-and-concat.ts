// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { basename, join } from 'path';
import { copyFileSync, readFileSync, writeFileSync } from 'fs';

// Concat

console.log('Concatenating...');

const BASE_BOWER = join(__dirname, '../../components');
const BASE_NODE = join(__dirname, '../../node_modules');
const CONCAT_TARGET = join(__dirname, '../../js/components.js');
const CONCAT_SOURCES = [
  join(BASE_NODE, 'jquery/dist/jquery.js'),
  join(BASE_NODE, 'mustache/mustache.js'),
  join(BASE_NODE, 'underscore/underscore.js'),
  join(BASE_BOWER, 'webaudiorecorder/lib/WebAudioRecorder.js'),
];

let concat = '// concatenated components.js';
CONCAT_SOURCES.forEach(source => {
  const contents = readFileSync(source, 'utf8');
  const name = basename(source);

  console.log(`Concatenating ${source}`);
  concat += `\n\n// ${name}\n${contents}`;
});

console.log(`Writing to ${CONCAT_TARGET}`);
writeFileSync(CONCAT_TARGET, concat);

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
