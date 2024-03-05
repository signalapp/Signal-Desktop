// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { tmpdir } from 'os';
import { readFile, writeFile, mkdtemp } from 'fs/promises';
import { gunzip as gunzipCb } from 'zlib';
import { join, basename } from 'path';
import { promisify } from 'util';
import { symbolicate } from '@electron/symbolicate-mac';
import pMap from 'p-map';

const gunzip = promisify(gunzipCb);

const INPUT_FILE = process.argv[2];

if (!INPUT_FILE) {
  throw new Error('Usage: node symbolicate-crash-report.js <input>');
}

async function main(): Promise<void> {
  let file = await readFile(INPUT_FILE);
  try {
    file = await gunzip(file);
  } catch (error) {
    console.error('Failed to decompress, perhaps file is a plaintext?');
  }

  const matches = file
    .toString()
    .matchAll(
      /WARN[^\n]*crashReports:\s+dump=\[REDACTED\]([0-9a-z]+).dmp\s+mtime="([\d\-T:.Z]+)"\s+({(\n|.)*?\n})/g
    );

  function moduleName(filename: string | undefined): string {
    if (!filename) {
      return '';
    }

    if (filename.startsWith('signal-desktop-')) {
      return 'electron';
    }

    if (filename.startsWith('Signal') && filename.endsWith('.exe')) {
      return 'electron.exe.pdb';
    }
    return filename;
  }

  const dumps = new Array<string>();
  for (const [, dump, mtime, json] of matches) {
    const out = [];

    let info;
    try {
      info = JSON.parse(json);
    } catch (error) {
      console.error('Failed to parse JSON, ignoring', dump, mtime, error);
      continue;
    }

    out.push(`## dump=${dump} mtime=${mtime}`);
    out.push('');
    out.push('```');

    for (const [index, frame] of info.crashing_thread.frames.entries()) {
      out.push(`${index} ${moduleName(frame.module)} ${frame.offset} () + 0`);
    }

    out.push('');

    for (const m of info.modules) {
      const filename = moduleName(m.filename);

      out.push(
        `${m.base_addr} - ${m.end_addr} ` +
          `${filename.replace(/\s+/g, '-')} (${m.version}) ` +
          `<${m.debug_id.slice(0, -1)}> ${filename}`
      );
    }
    out.push('```');

    dumps.push(out.join('\n'));
  }

  const tmpFolder = await mkdtemp(join(tmpdir(), 'parse-crash-reports'));

  const result = await pMap(
    dumps,
    async (text, i) => {
      const tmpFile = join(tmpFolder, `${i}.txt`);
      await writeFile(tmpFile, text);

      console.error(`Symbolicating: ${tmpFile}`);
      return symbolicate({ file: tmpFile });
    },
    { concurrency: 1 }
  );

  console.log(`# Crash Report ${basename(INPUT_FILE)}`);
  console.log('');
  console.log(result.join('\n'));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
