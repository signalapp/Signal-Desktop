// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */

import * as fs from 'node:fs';
import * as fse from 'fs-extra';
import * as os from 'node:os';
import * as path from 'node:path';
import { assert } from 'chai';

import {
  eliminateOutOfDateFiles,
  eliminateOldEntries,
  isLineAfterDate,
  fetchLog,
  fetchLogs,
} from '../logging/main_process_logging.main.js';

describe('logging', () => {
  const fakeLogEntry = ({
    level = 30,
    msg = 'hello world',
    time = new Date().toISOString(),
  }: {
    level?: number;
    msg?: string;
    time?: string;
  }): Record<string, unknown> => ({
    level,
    msg,
    time,
  });

  const fakeLogLine = (...args: Parameters<typeof fakeLogEntry>): string =>
    JSON.stringify(fakeLogEntry(...args));

  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'signal-test-'));
  });

  afterEach(async () => {
    await fse.remove(tmpDir);
  });

  describe('#isLineAfterDate', () => {
    it('returns false if falsy', () => {
      const actual = isLineAfterDate('', new Date());
      assert.isFalse(actual);
    });
    it('returns false if invalid JSON', () => {
      const actual = isLineAfterDate('{{}', new Date());
      assert.isFalse(actual);
    });
    it('returns false if date is invalid', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:05.014Z' });
      const actual = isLineAfterDate(line, new Date('try6'));
      assert.isFalse(actual);
    });
    it('returns false if log time is invalid', () => {
      const line = JSON.stringify({ time: 'try7' });
      const date = new Date('2018-01-04T19:17:00.000Z');
      const actual = isLineAfterDate(line, date);
      assert.isFalse(actual);
    });
    it('returns false if date before provided date', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:00.000Z' });
      const date = new Date('2018-01-04T19:17:05.014Z');
      const actual = isLineAfterDate(line, date);
      assert.isFalse(actual);
    });
    it('returns true if date is after provided date', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:05.014Z' });
      const date = new Date('2018-01-04T19:17:00.000Z');
      const actual = isLineAfterDate(line, date);
      assert.isTrue(actual);
    });
  });

  describe('#eliminateOutOfDateFiles', () => {
    it('deletes an empty file', () => {
      const date = new Date();
      const log = '\n';
      const target = path.join(tmpDir, 'log.log');
      fs.writeFileSync(target, log);

      return eliminateOutOfDateFiles(tmpDir, date).then(() => {
        assert.isFalse(fs.existsSync(target));
      });
    });
    it('deletes a file with invalid JSON lines', () => {
      const date = new Date();
      const log = '{{}\n';
      const target = path.join(tmpDir, 'log.log');
      fs.writeFileSync(target, log);

      return eliminateOutOfDateFiles(tmpDir, date).then(() => {
        assert.isFalse(fs.existsSync(target));
      });
    });
    it('deletes a file with all dates before provided date', () => {
      const date = new Date('2018-01-04T19:17:05.014Z');
      const contents = [
        JSON.stringify({ time: '2018-01-04T19:17:00.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const target = path.join(tmpDir, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(tmpDir, date).then(() => {
        assert.isFalse(fs.existsSync(target));
      });
    });
    it('keeps a file with first line date before provided date', () => {
      const date = new Date('2018-01-04T19:16:00.000Z');
      const contents = [
        JSON.stringify({ time: '2018-01-04T19:17:00.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const target = path.join(tmpDir, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(tmpDir, date).then(() => {
        assert.isTrue(fs.existsSync(target));
      });
    });
    it('keeps a file with last line date before provided date', () => {
      const date = new Date('2018-01-04T19:17:01.000Z');
      const contents = [
        JSON.stringify({ time: '2018-01-04T19:17:00.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const target = path.join(tmpDir, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(tmpDir, date).then(() => {
        assert.isTrue(fs.existsSync(target));
      });
    });
  });

  describe('#eliminateOldEntries', () => {
    it('eliminates all non-parsing entries', () => {
      const date = new Date('2018-01-04T19:17:01.000Z');
      const contents = [
        'random line',
        fakeLogLine({ time: '2018-01-04T19:17:01.014Z' }),
        fakeLogLine({ time: '2018-01-04T19:17:02.014Z' }),
        fakeLogLine({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const expected = [
        fakeLogEntry({ time: '2018-01-04T19:17:01.014Z' }),
        fakeLogEntry({ time: '2018-01-04T19:17:02.014Z' }),
        fakeLogEntry({ time: '2018-01-04T19:17:03.014Z' }),
      ];

      const target = path.join(tmpDir, 'log.log');
      const files = [
        {
          path: target,
        },
      ];

      fs.writeFileSync(target, contents);

      return eliminateOldEntries(files, date).then(() => {
        const actualEntries = fs
          .readFileSync(target, 'utf8')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => JSON.parse(line));
        assert.deepStrictEqual(actualEntries, expected);
      });
    });
    it('preserves all lines if before target date', () => {
      const date = new Date('2018-01-04T19:17:03.000Z');
      const contents = [
        'random line',
        fakeLogLine({ time: '2018-01-04T19:17:01.014Z' }),
        fakeLogLine({ time: '2018-01-04T19:17:02.014Z' }),
        fakeLogLine({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const expected = fakeLogEntry({ time: '2018-01-04T19:17:03.014Z' });

      const target = path.join(tmpDir, 'log.log');
      const files = [
        {
          path: target,
        },
      ];

      fs.writeFileSync(target, contents);

      return eliminateOldEntries(files, date).then(() => {
        // There should only be 1 line, so we can parse it safely.
        assert.deepStrictEqual(
          JSON.parse(fs.readFileSync(target, 'utf8')),
          expected
        );
      });
    });
  });

  describe('#fetchLog', () => {
    it('returns error if file does not exist', () => {
      const target = 'random_file';
      return fetchLog(target).then(
        () => {
          throw new Error('Expected an error!');
        },
        error => {
          assert.match(error.message, /random_file/);
        }
      );
    });
    it('returns empty array if file has no valid JSON lines', () => {
      const contents = 'line 1\nline2\n';
      const target = path.join(tmpDir, 'test.log');

      fs.writeFileSync(target, contents);

      return fetchLog(target).then(result => {
        assert.isEmpty(result);
      });
    });
    it('returns just three fields in each returned line', () => {
      const contents = [
        JSON.stringify({
          one: 1,
          two: 2,
          level: 30,
          time: '2020-04-20T06:09:08.000Z',
          msg: 'message 1',
        }),
        JSON.stringify({
          one: 1,
          two: 2,
          level: 40,
          time: '2021-04-20T06:09:08.000Z',
          msg: 'message 2',
        }),
        '',
      ].join('\n');
      const expected = [
        {
          level: 30,
          time: '2020-04-20T06:09:08.000Z',
          msg: 'message 1',
        },
        {
          level: 40,
          time: '2021-04-20T06:09:08.000Z',
          msg: 'message 2',
        },
      ];

      const target = path.join(tmpDir, 'test.log');

      fs.writeFileSync(target, contents);

      return fetchLog(target).then(result => {
        assert.deepStrictEqual(result, expected);
      });
    });
  });

  describe('#fetchLogs', () => {
    it('returns single entry if no files', () => {
      return fetchLogs(tmpDir).then(results => {
        assert.lengthOf(results, 1);
        assert.match(results[0]?.msg || '', /Loaded this list/);
      });
    });
    it('returns sorted entries from all files', () => {
      const first = [
        fakeLogLine({ msg: '2', time: '2018-01-04T19:17:05.014Z' }),
        '',
      ].join('\n');
      const second = [
        fakeLogLine({ msg: '1', time: '2018-01-04T19:17:00.014Z' }),
        fakeLogLine({ msg: '3', time: '2018-01-04T19:18:00.014Z' }),
        '',
      ].join('\n');

      fs.writeFileSync(path.join(tmpDir, 'first.log'), first);
      fs.writeFileSync(path.join(tmpDir, 'second.log'), second);

      return fetchLogs(tmpDir).then(results => {
        assert.lengthOf(results, 4);
        assert.strictEqual(results[0]?.msg, '1');
        assert.strictEqual(results[1]?.msg, '2');
        assert.strictEqual(results[2]?.msg, '3');
      });
    });
  });
});
