const { expect } = require('chai');

const { _urlToPath } = require('../../app/protocol_filter');

describe('Protocol Filter', () => {
  describe('_urlToPath', () => {
    it('returns proper file path for unix style file URI with hash', () => {
      const path =
        'file:///Users/someone/Development/signal/electron/background.html#first-page';
      const expected =
        '/Users/someone/Development/signal/electron/background.html';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    it('returns proper file path for unix style file URI with querystring', () => {
      const path =
        'file:///Users/someone/Development/signal/electron/background.html?name=Signal&locale=en&version=2.4.0';
      const expected =
        '/Users/someone/Development/signal/electron/background.html';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    it('returns proper file path for unix style file URI with hash and querystring', () => {
      const path =
        'file:///Users/someone/Development/signal/electron/background.html#somewhere?name=Signal';
      const expected =
        '/Users/someone/Development/signal/electron/background.html';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    it('returns proper file path for windows style file URI', () => {
      const path =
        'file:///C:/Users/Someone/dev/desktop/background.html?name=Signal&locale=en&version=2.4.0';
      const expected = 'C:/Users/Someone/dev/desktop/background.html';

      const actual = _urlToPath(path, { isWindows: true });
      expect(actual).to.equal(expected);
    });

    it('translates from URL format to filesystem format', () => {
      const path =
        'file:///Users/someone/Development%20Files/signal/electron/background.html';
      const expected =
        '/Users/someone/Development Files/signal/electron/background.html';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    it('translates from URL format to filesystem format', () => {
      const path =
        'file:///Users/someone/Development%20Files/signal/electron/background.html';
      const expected =
        '/Users/someone/Development Files/signal/electron/background.html';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    // this seems to be the only way to get a relative path through Electron
    it('handles SMB share path', () => {
      const path = 'file://relative/path';
      const expected = 'relative/path';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });

    it('hands back a path with .. in it', () => {
      const path = 'file://../../..';
      const expected = '../../..';

      const actual = _urlToPath(path);
      expect(actual).to.equal(expected);
    });
  });
});
