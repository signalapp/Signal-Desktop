// NOTE: Temporarily allow `then` until we convert the entire file to `async` / `await`:
/* eslint-disable more/no-then */

const fs = require('fs');
const path = require('path');

const tmp = require('tmp');
const { expect } = require('chai');

const {
  eliminateOutOfDateFiles,
  eliminateOldEntries,
  isLineAfterDate,
  fetchLog,
  fetch,
} = require('../../../app/logging');

describe('app/logging', () => {
  let basePath;
  let tmpDir;

  beforeEach(() => {
    tmpDir = tmp.dirSync({
      unsafeCleanup: true,
    });
    basePath = tmpDir.name;
  });

  afterEach((done) => {
    // we need the unsafe option to recursively remove the directory
    tmpDir.removeCallback(done);
  });

  describe('#isLineAfterDate', () => {
    it('returns false if falsy', () => {
      const actual = isLineAfterDate('', new Date());
      expect(actual).to.equal(false);
    });
    it('returns false if invalid JSON', () => {
      const actual = isLineAfterDate('{{}', new Date());
      expect(actual).to.equal(false);
    });
    it('returns false if date is invalid', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:05.014Z' });
      const actual = isLineAfterDate(line, new Date('try6'));
      expect(actual).to.equal(false);
    });
    it('returns false if log time is invalid', () => {
      const line = JSON.stringify({ time: 'try7' });
      const date = new Date('2018-01-04T19:17:00.000Z');
      const actual = isLineAfterDate(line, date);
      expect(actual).to.equal(false);
    });
    it('returns false if date before provided date', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:00.000Z' });
      const date = new Date('2018-01-04T19:17:05.014Z');
      const actual = isLineAfterDate(line, date);
      expect(actual).to.equal(false);
    });
    it('returns true if date is after provided date', () => {
      const line = JSON.stringify({ time: '2018-01-04T19:17:05.014Z' });
      const date = new Date('2018-01-04T19:17:00.000Z');
      const actual = isLineAfterDate(line, date);
      expect(actual).to.equal(true);
    });
  });

  describe('#eliminateOutOfDateFiles', () => {
    it('deletes an empty file', () => {
      const date = new Date();
      const log = '\n';
      const target = path.join(basePath, 'log.log');
      fs.writeFileSync(target, log);

      return eliminateOutOfDateFiles(basePath, date).then(() => {
        expect(fs.existsSync(target)).to.equal(false);
      });
    });
    it('deletes a file with invalid JSON lines', () => {
      const date = new Date();
      const log = '{{}\n';
      const target = path.join(basePath, 'log.log');
      fs.writeFileSync(target, log);

      return eliminateOutOfDateFiles(basePath, date).then(() => {
        expect(fs.existsSync(target)).to.equal(false);
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
      const target = path.join(basePath, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(basePath, date).then(() => {
        expect(fs.existsSync(target)).to.equal(false);
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
      const target = path.join(basePath, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(basePath, date).then(() => {
        expect(fs.existsSync(target)).to.equal(true);
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
      const target = path.join(basePath, 'log.log');
      fs.writeFileSync(target, contents);

      return eliminateOutOfDateFiles(basePath, date).then(() => {
        expect(fs.existsSync(target)).to.equal(true);
      });
    });
  });

  describe('#eliminateOldEntries', () => {
    it('eliminates all non-parsing entries', () => {
      const date = new Date('2018-01-04T19:17:01.000Z');
      const contents = [
        'random line',
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const expected = [
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');

      const target = path.join(basePath, 'log.log');
      const files = [{
        path: target,
      }];

      fs.writeFileSync(target, contents);

      return eliminateOldEntries(files, date).then(() => {
        expect(fs.readFileSync(target, 'utf8')).to.equal(`${expected}\n`);
      });
    });
    it('preserves all lines if before target date', () => {
      const date = new Date('2018-01-04T19:17:03.000Z');
      const contents = [
        'random line',
        JSON.stringify({ time: '2018-01-04T19:17:01.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:02.014Z' }),
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');
      const expected = [
        JSON.stringify({ time: '2018-01-04T19:17:03.014Z' }),
      ].join('\n');

      const target = path.join(basePath, 'log.log');
      const files = [{
        path: target,
      }];

      fs.writeFileSync(target, contents);

      return eliminateOldEntries(files, date).then(() => {
        expect(fs.readFileSync(target, 'utf8')).to.equal(`${expected}\n`);
      });
    });
  });

  describe('#fetchLog', () => {
    it('returns error if file does not exist', () => {
      const target = 'random_file';
      return fetchLog(target).then(() => {
        throw new Error('Expected an error!');
      }, (error) => {
        expect(error).to.have.property('message').that.match(/random_file/);
      });
    });
    it('returns empty array if file has no valid JSON lines', () => {
      const contents = 'line 1\nline2\n';
      const expected = [];
      const target = path.join(basePath, 'test.log');

      fs.writeFileSync(target, contents);

      return fetchLog(target).then((result) => {
        expect(result).to.deep.equal(expected);
      });
    });
    it('returns just three fields in each returned line', () => {
      const contents = [
        JSON.stringify({
          one: 1,
          two: 2,
          level: 1,
          time: 2,
          msg: 3,
        }),
        JSON.stringify({
          one: 1,
          two: 2,
          level: 2,
          time: 3,
          msg: 4,
        }),
        '',
      ].join('\n');
      const expected = [{
        level: 1,
        time: 2,
        msg: 3,
      }, {
        level: 2,
        time: 3,
        msg: 4,
      }];

      const target = path.join(basePath, 'test.log');

      fs.writeFileSync(target, contents);

      return fetchLog(target).then((result) => {
        expect(result).to.deep.equal(expected);
      });
    });
  });

  describe('#fetch', () => {
    it('returns single entry if no files', () => {
      return fetch(basePath).then((results) => {
        expect(results).to.have.length(1);
        expect(results[0].msg).to.match(/Loaded this list/);
      });
    });
    it('returns sorted entries from all files', () => {
      const first = [
        JSON.stringify({ msg: 2, time: '2018-01-04T19:17:05.014Z' }),
        '',
      ].join('\n');
      const second = [
        JSON.stringify({ msg: 1, time: '2018-01-04T19:17:00.014Z' }),
        JSON.stringify({ msg: 3, time: '2018-01-04T19:18:00.014Z' }),
        '',
      ].join('\n');

      fs.writeFileSync(path.join(basePath, 'first.log'), first);
      fs.writeFileSync(path.join(basePath, 'second.log'), second);

      return fetch(basePath).then((results) => {
        expect(results).to.have.length(4);
        expect(results[0].msg).to.equal(1);
        expect(results[1].msg).to.equal(2);
        expect(results[2].msg).to.equal(3);
      });
    });
  });
});
