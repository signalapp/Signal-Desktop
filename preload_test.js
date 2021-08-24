/* global window */

// This is a hack to let us run TypeScript tests in the renderer process. See the
//   code in `test/index.html`.
const pendingDescribeCalls = [];
window.describe = (...args) => {
  pendingDescribeCalls.push(args);
};

/* eslint-disable global-require, import/no-extraneous-dependencies */
const fastGlob = require('fast-glob');

fastGlob
  .sync('./ts/test-{both,electron}/**/*_test.js', {
    absolute: true,
    cwd: __dirname,
  })
  .forEach(require);

delete window.describe;

window.test = {
  pendingDescribeCalls,
  fastGlob,
  normalizePath: require('normalize-path'),
  fse: require('fs-extra'),
  tmp: require('tmp'),
  path: require('path'),
  basePath: __dirname,
  attachmentsPath: window.Signal.Migrations.attachmentsPath,
};
