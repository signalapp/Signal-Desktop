import { assert } from 'chai';

import {
  createTempDir,
  getUpdateFileName,
  getVersion,
  isUpdateFileNameValid,
  validatePath,
} from '../../updater/common';

describe('updater/signatures', () => {
  const windows = `version: 1.23.2
files:
  - url: signal-desktop-win-1.23.2.exe
    sha512: hhK+cVAb+QOK/Ln0RBcq8Rb1iPcUC0KZeT4NwLB25PMGoPmakY27XE1bXq4QlkASJN1EkYTbKf3oUJtcllziyQ==
    size: 92020776
path: signal-desktop-win-1.23.2.exe
sha512: hhK+cVAb+QOK/Ln0RBcq8Rb1iPcUC0KZeT4NwLB25PMGoPmakY27XE1bXq4QlkASJN1EkYTbKf3oUJtcllziyQ==
releaseDate: '2019-03-29T16:58:08.210Z'
`;
  const mac = `version: 1.23.2
files:
  - url: signal-desktop-mac-1.23.2.zip
    sha512: f4pPo3WulTVi9zBWGsJPNIlvPOTCxPibPPDmRFDoXMmFm6lqJpXZQ9DSWMJumfc4BRp4y/NTQLGYI6b4WuJwhg==
    size: 105179791
    blockMapSize: 111109
path: signal-desktop-mac-1.23.2.zip
sha512: f4pPo3WulTVi9zBWGsJPNIlvPOTCxPibPPDmRFDoXMmFm6lqJpXZQ9DSWMJumfc4BRp4y/NTQLGYI6b4WuJwhg==
releaseDate: '2019-03-29T16:57:16.997Z'
`;
  const windowsBeta = `version: 1.23.2-beta.1
files:
  - url: signal-desktop-beta-win-1.23.2-beta.1.exe
    sha512: ZHM1F3y/Y6ulP5NhbFuh7t2ZCpY4lD9BeBhPV+g2B/0p/66kp0MJDeVxTgjR49OakwpMAafA1d6y2QBail4hSQ==
    size: 92028656
path: signal-desktop-beta-win-1.23.2-beta.1.exe
sha512: ZHM1F3y/Y6ulP5NhbFuh7t2ZCpY4lD9BeBhPV+g2B/0p/66kp0MJDeVxTgjR49OakwpMAafA1d6y2QBail4hSQ==
releaseDate: '2019-03-29T01:56:00.544Z'
`;
  const macBeta = `version: 1.23.2-beta.1
files:
  - url: signal-desktop-beta-mac-1.23.2-beta.1.zip
    sha512: h/01N0DD5Jw2Q6M1n4uLGLTCrMFxcn8QOPtLR3HpABsf3w9b2jFtKb56/2cbuJXP8ol8TkTDWKnRV6mnqnLBDw==
    size: 105182398
    blockMapSize: 110894
path: signal-desktop-beta-mac-1.23.2-beta.1.zip
sha512: h/01N0DD5Jw2Q6M1n4uLGLTCrMFxcn8QOPtLR3HpABsf3w9b2jFtKb56/2cbuJXP8ol8TkTDWKnRV6mnqnLBDw==
releaseDate: '2019-03-29T01:53:23.881Z'
`;

  describe('#getVersion', () => {
    it('successfully gets version', () => {
      const expected = '1.23.2';
      assert.strictEqual(getVersion(windows), expected);
      assert.strictEqual(getVersion(mac), expected);

      const expectedBeta = '1.23.2-beta.1';
      assert.strictEqual(getVersion(windowsBeta), expectedBeta);
      assert.strictEqual(getVersion(macBeta), expectedBeta);
    });
  });

  describe('#getUpdateFileName', () => {
    it('successfully gets version', () => {
      assert.strictEqual(
        getUpdateFileName(windows),
        'signal-desktop-win-1.23.2.exe'
      );
      assert.strictEqual(
        getUpdateFileName(mac),
        'signal-desktop-mac-1.23.2.zip'
      );
      assert.strictEqual(
        getUpdateFileName(windowsBeta),
        'signal-desktop-beta-win-1.23.2-beta.1.exe'
      );
      assert.strictEqual(
        getUpdateFileName(macBeta),
        'signal-desktop-beta-mac-1.23.2-beta.1.zip'
      );
    });
  });

  describe('#isUpdateFileNameValid', () => {
    it('returns true for normal filenames', () => {
      assert.strictEqual(
        isUpdateFileNameValid('signal-desktop-win-1.23.2.exe'),
        true
      );
      assert.strictEqual(
        isUpdateFileNameValid('signal-desktop-mac-1.23.2-beta.1.zip'),
        true
      );
    });
    it('returns false for problematic names', () => {
      assert.strictEqual(
        isUpdateFileNameValid('../signal-desktop-win-1.23.2.exe'),
        false
      );
      assert.strictEqual(
        isUpdateFileNameValid('%signal-desktop-mac-1.23.2-beta.1.zip'),
        false
      );
      assert.strictEqual(
        isUpdateFileNameValid('@signal-desktop-mac-1.23.2-beta.1.zip'),
        false
      );
    });
  });

  describe('#validatePath', () => {
    it('succeeds for simple children', async () => {
      const base = await createTempDir();
      validatePath(base, `${base}/child`);
      validatePath(base, `${base}/child/grandchild`);
    });
    it('returns false for problematic names', async () => {
      const base = await createTempDir();
      assert.throws(() => {
        validatePath(base, `${base}/../child`);
      });
      assert.throws(() => {
        validatePath(base, '/root');
      });
    });
  });
});
