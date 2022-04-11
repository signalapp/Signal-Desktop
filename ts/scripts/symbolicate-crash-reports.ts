// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs/promises';
import path from 'path';
import http from 'http';
import https from 'https';
import { tmpdir } from 'os';
import { execFile as rawExecFile } from 'child_process';
import { promisify } from 'util';

import { strictAssert } from '../util/assert';
import { wrapEventEmitterOnce } from '../util/wrapEventEmitterOnce';
import { SignalService as Proto } from '../protobuf';

const execFile = promisify(rawExecFile);

const TARGET = 'https://symbols.electronjs.org';

const proxyServer = http
  .createServer(({ method, url = '/' }, res) => {
    console.log(`Proxy server got request ${method} ${url}`);
    if (method !== 'GET') {
      throw new Error('Unsupported');
    }

    // eslint-disable-next-line no-useless-escape
    const patchedURL = url.replace(/signal-desktop-[^\/.]+/g, 'electron');

    https.get(`${TARGET}${patchedURL}`, remoteRes => {
      res.writeHead(remoteRes.statusCode ?? 500, remoteRes.headers);

      remoteRes.pipe(res);
    });
  })
  .unref();

async function symbolicate(
  outDir: string,
  fileName: string,
  proxyPort: number
): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(tmpdir(), 'signal-crashe'));
  await fs.mkdir(tmpDir, { recursive: true });

  const encoded = await fs.readFile(fileName);
  const { reports } = Proto.CrashReportList.decode(encoded);

  const { name: prefix } = path.parse(fileName);

  await Promise.all(
    reports.map(async ({ filename: reportName, content }) => {
      if (!reportName || !content) {
        return;
      }

      const { base, name, ext } = path.parse(reportName);
      if (ext !== '.dmp') {
        console.log(`Ignoring ${reportName}, wrong extension`);
        return;
      }

      const dumpFile = path.join(tmpDir, `${prefix}-${base}`);
      console.log(`Extracting to ${dumpFile}`);
      await fs.writeFile(dumpFile, content);

      const outFile = path.join(outDir, `${prefix}-${name}.txt`);

      await execFile('minidump-stackwalk', [
        '--symbols-url',
        `http://127.0.0.1:${proxyPort}`,
        '--output-file',
        outFile,
        dumpFile,
      ]);
      console.log(`Symbolicating ${dumpFile} to ${outFile}`);
    })
  );
}

async function main(
  outDir: string,
  fileNames: ReadonlyArray<string>
): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });

  proxyServer.listen(0);

  await wrapEventEmitterOnce(proxyServer, 'listening');
  const addr = proxyServer.address();
  strictAssert(
    typeof addr === 'object' && addr !== null,
    'Address has to be an object'
  );

  const { port: proxyPort } = addr;

  console.log(`Proxy server listening on ${proxyPort}`);

  await Promise.all(
    fileNames.map(fileName => symbolicate(outDir, fileName, proxyPort))
  );

  proxyServer.close();
}

main(process.argv[2], process.argv.slice(3)).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
