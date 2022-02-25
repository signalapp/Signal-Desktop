// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import http from 'http';
import fs from 'fs/promises';
import { tmpdir } from 'os';

import { strictAssert } from '../../util/assert';
import {
  computeDiff,
  getBlockMapFileName,
  prepareDownload,
  isValidPreparedData,
  download,
} from '../../updater/differential';

const FIXTURES = path.join(__dirname, '..', '..', '..', 'fixtures');

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

    const newFile = 'diff-modified.bin';
    const newBlockFile = getBlockMapFileName(newFile);
    const newHash =
      '1+eipIhsN0KhpXQdRnXnGzdBCP3sgYqIXf+WK/KDK08' +
      'VvH0acjX9PGf+ilIVYYWsOqp02lxrdx4gXW7V+RZY5w==';

    const allowedFiles = new Set([
      oldFile,
      oldBlockFile,
      newFile,
      newBlockFile,
    ]);

    let server: http.Server;
    let baseUrl: string;

    beforeEach(callback => {
      server = http.createServer(async (req, res) => {
        const file = req.url?.slice(1) ?? '';
        if (!allowedFiles.has(file)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const range = req.headers.range?.match(/^bytes=(\d+)-(\d+)$/);

        let content = await fs.readFile(path.join(FIXTURES, file));
        const totalSize = content.length;
        if (range) {
          content = content.slice(
            parseInt(range[1], 10),
            parseInt(range[2], 10) + 1
          );

          res.setHeader(
            'content-range',
            `bytes ${range[1]}-${range[2]}/${totalSize}`
          );
          res.writeHead(206);
        } else {
          res.writeHead(200);
        }

        res.end(content);
      });

      server.unref();

      server.listen(0, () => {
        const addr = server.address();
        strictAssert(typeof addr === 'object' && addr, 'node.js apis');
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

      assert.strictEqual(data.downloadSize, 32768);
      assert.deepStrictEqual(data.diff, [
        { action: 'copy', readOffset: 0, size: 204635, writeOffset: 0 },
        {
          action: 'download',
          size: 32768,
          readOffset: 204635,
          writeOffset: 204635,
        },
        {
          action: 'copy',
          readOffset: 237403,
          size: 24741,
          writeOffset: 237403,
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
      await download(outFile, data, size => chunks.push(size));

      const expected = await fs.readFile(path.join(FIXTURES, newFile));
      const actual = await fs.readFile(outFile);

      assert.isTrue(actual.equals(expected), 'Files do not match');
      assert.isTrue(
        chunks.length > 0,
        'Expected multiple callback invocations'
      );
    });
  });
});
