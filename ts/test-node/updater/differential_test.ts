// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import http from 'http';
import fs from 'fs/promises';
import { tmpdir } from 'os';

import { strictAssert } from '../../util/assert';
import * as durations from '../../util/durations';
import { getGotOptions } from '../../updater/got';
import {
  computeDiff,
  getBlockMapFileName,
  prepareDownload,
  isValidPreparedData,
  download,
} from '../../updater/differential';

const FIXTURES = path.join(__dirname, '..', '..', '..', 'fixtures');
const CRLF = '\r\n';

describe('updater/differential', () => {
  describe('computeDiff', () => {
    it('computes correct difference', () => {
      const old = [
        { checksum: 'a', offset: 0, size: 2 },
        { checksum: 'b', offset: 2, size: 4 },
        { checksum: 'c', offset: 6, size: 1 },
        { checksum: 'c', offset: 7, size: 1 },
        { checksum: 'd', offset: 8, size: 4 },
      ];

      const next = [
        { checksum: 'prepend', offset: 0, size: 2 },
        { checksum: 'not a', offset: 2, size: 4 },
        { checksum: 'b', offset: 6, size: 4 },
        { checksum: 'c', offset: 10, size: 1 },
        { checksum: 'c', offset: 11, size: 1 },
        { checksum: 'insert', offset: 12, size: 5 },
        { checksum: 'c', offset: 17, size: 1 },
        { checksum: 'd', offset: 18, size: 4 },
        { checksum: 'append', offset: 22, size: 3 },
      ];

      assert.deepStrictEqual(computeDiff(old, next), [
        { action: 'download', readOffset: 0, size: 6, writeOffset: 0 },
        { action: 'copy', readOffset: 2, size: 6, writeOffset: 6 },
        // Note: this includes the third "c"
        { action: 'download', readOffset: 12, size: 6, writeOffset: 12 },
        // This is "d"
        { action: 'copy', readOffset: 8, size: 4, writeOffset: 18 },
        { action: 'download', readOffset: 22, size: 3, writeOffset: 22 },
      ]);
    });
  });

  describe('prepareDownload/download', () => {
    const oldFile = 'diff-original.bin';
    const oldBlockFile = getBlockMapFileName(oldFile);

    const emptyFile = 'diff-empty.bin';

    const newFile = 'diff-modified.bin';
    const newBlockFile = getBlockMapFileName(newFile);
    const newHash =
      'oEXIz7JVN1phjmumPLVQuwSYa+tHLEn5/a+q9w/pbk' +
      'bnCaXAioWrAIq1P9HeqNQ0Lpsb4mWey632DUPnUXqfiw==';

    const allowedFiles = new Set([
      oldFile,
      oldBlockFile,
      newFile,
      newBlockFile,
    ]);

    let server: http.Server;
    let baseUrl: string;
    let shouldTimeout: 'response' | undefined;

    beforeEach(callback => {
      shouldTimeout = undefined;
      server = http.createServer(async (req, res) => {
        if (!req.headers['user-agent']?.includes('Signal-Desktop')) {
          res.writeHead(403);
          res.end(`Invalid user agent: "${req.headers['user-agent']}"`);
          return;
        }

        const file = req.url?.slice(1) ?? '';
        if (!allowedFiles.has(file)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const fullFile = await fs.readFile(path.join(FIXTURES, file));

        const rangeHeader = req.headers.range?.match(/^bytes=([\d,\s-]+)$/);
        if (!rangeHeader) {
          res.writeHead(200);
          res.end(fullFile);
          return;
        }

        const ranges = rangeHeader[1].split(/\s*,\s*/g).map(value => {
          const range = value.match(/^(\d+)-(\d+)$/);
          strictAssert(range, `Invalid header: ${rangeHeader}`);

          return [parseInt(range[1], 10), parseInt(range[2], 10)];
        });

        if (ranges.length === 1) {
          res.writeHead(206, {
            'content-type': 'application/octet-stream',
          });
          if (shouldTimeout === 'response') {
            res.flushHeaders();
            return;
          }

          const [from, to] = ranges[0];
          res.end(fullFile.slice(from, to + 1));
          return;
        }

        const BOUNDARY = 'f8f254ce1ba37627';

        res.writeHead(206, {
          'content-type': `multipart/byteranges; boundary=${BOUNDARY}`,
        });
        if (shouldTimeout === 'response') {
          res.flushHeaders();
          return;
        }

        const totalSize = fullFile.length;

        const multipart = Buffer.concat([
          ...ranges
            .map(([from, to]) => [
              Buffer.from(
                [
                  `--${BOUNDARY}`,
                  'Content-Type: binary/octet-stream',
                  `Content-Range: bytes ${from}-${to}/${totalSize}`,
                  '',
                  '',
                ].join(CRLF)
              ),
              fullFile.slice(from, to + 1),
              Buffer.from(CRLF),
            ])
            .flat(),
          Buffer.from(`--${BOUNDARY}--${CRLF}`),
        ]);

        res.end(multipart);
      });

      server.unref();

      server.listen(0, () => {
        const addr = server.address();
        strictAssert(typeof addr === 'object' && addr != null, 'node.js apis');
        baseUrl = `http://127.0.0.1:${addr.port}`;

        callback();
      });
    });

    afterEach(() => {
      server.close();
    });

    it('prepares the download', async () => {
      const data = await prepareDownload({
        oldFile: path.join(FIXTURES, oldFile),
        newUrl: `${baseUrl}/${newFile}`,
        sha512: newHash,
      });

      assert.strictEqual(data.downloadSize, 62826);
      assert.deepStrictEqual(data.diff, [
        { action: 'copy', size: 44288, readOffset: 0, writeOffset: 0 },
        {
          action: 'download',
          size: 8813,
          readOffset: 44288,
          writeOffset: 44288,
        },
        {
          action: 'copy',
          size: 37849,
          readOffset: 53101,
          writeOffset: 53101,
        },
        {
          action: 'download',
          size: 21245,
          readOffset: 90950,
          writeOffset: 90950,
        },
        {
          action: 'copy',
          size: 116397,
          readOffset: 112195,
          writeOffset: 112195,
        },
        {
          action: 'download',
          size: 32768,
          readOffset: 228592,
          writeOffset: 228592,
        },
        {
          action: 'copy',
          size: 784,
          readOffset: 261360,
          writeOffset: 261360,
        },
      ]);
    });

    it('checks that the data is valid to facilitate caching', async () => {
      const oldFilePath = path.join(FIXTURES, oldFile);
      const newUrl = `${baseUrl}/${newFile}`;

      const data = await prepareDownload({
        oldFile: oldFilePath,
        newUrl,
        sha512: newHash,
      });

      assert.isTrue(
        isValidPreparedData(data, {
          oldFile: oldFilePath,
          newUrl,
          sha512: newHash,
        })
      );

      assert.isFalse(
        isValidPreparedData(data, {
          oldFile: 'different file',
          newUrl,
          sha512: newHash,
        })
      );

      assert.isFalse(
        isValidPreparedData(data, {
          oldFile: oldFilePath,
          newUrl: 'different url',
          sha512: newHash,
        })
      );

      assert.isFalse(
        isValidPreparedData(data, {
          oldFile: oldFilePath,
          newUrl,
          sha512: 'different hash',
        })
      );
    });

    it('downloads the file', async () => {
      const data = await prepareDownload({
        oldFile: path.join(FIXTURES, oldFile),
        newUrl: `${baseUrl}/${newFile}`,
        sha512: newHash,
      });

      const outDir = await fs.mkdtemp(path.join(tmpdir(), 'signal-temp-'));
      await fs.mkdir(outDir, { recursive: true });

      const outFile = path.join(outDir, 'out.bin');
      const chunks = new Array<number>();
      await download(outFile, data, {
        statusCallback(size) {
          chunks.push(size);
        },
      });

      const expected = await fs.readFile(path.join(FIXTURES, newFile));
      const actual = await fs.readFile(outFile);

      assert.isTrue(actual.equals(expected), 'Files do not match');
      assert.isTrue(
        chunks.length > 0,
        'Expected multiple callback invocations'
      );
    });

    it('downloads the full file with a single range', async () => {
      const data = await prepareDownload({
        oldFile: path.join(FIXTURES, emptyFile),
        newUrl: `${baseUrl}/${newFile}`,
        sha512: newHash,
      });

      const outDir = await fs.mkdtemp(path.join(tmpdir(), 'signal-temp-'));
      await fs.mkdir(outDir, { recursive: true });

      const outFile = path.join(outDir, 'out.bin');
      const chunks = new Array<number>();
      await download(outFile, data, {
        statusCallback(size) {
          chunks.push(size);
        },
      });

      const expected = await fs.readFile(path.join(FIXTURES, newFile));
      const actual = await fs.readFile(outFile);

      assert.isTrue(actual.equals(expected), 'Files do not match');
      assert.isTrue(
        chunks.length > 0,
        'Expected multiple callback invocations'
      );
    });

    it('handles response timeouts gracefully', async () => {
      const data = await prepareDownload({
        oldFile: path.join(FIXTURES, oldFile),
        newUrl: `${baseUrl}/${newFile}`,
        sha512: newHash,
      });

      const outDir = await fs.mkdtemp(path.join(tmpdir(), 'signal-temp-'));
      await fs.mkdir(outDir, { recursive: true });

      const outFile = path.join(outDir, 'out.bin');

      shouldTimeout = 'response';
      await assert.isRejected(
        download(outFile, data, {
          gotOptions: {
            ...(await getGotOptions()),
            timeout: {
              connect: 0.5 * durations.SECOND,
              lookup: 0.5 * durations.SECOND,
              socket: 0.5 * durations.SECOND,
            },
          },
        }),
        /Timeout awaiting 'socket' for 500ms/
      );
    });
  });
});
