const ignoredFiles = [
  'package.json',
  'yarn.lock',
  'tsconfig.json',
  '.lintstagedrc.js',
  '.eslintrc.js',
];

const path = require('path');

const buildFormatCommand = filenames => {
  const results = filenames
    .map(f => path.relative(process.cwd(), f))
    .filter(f => !ignoredFiles.includes(f));

  return results.length ? `prettier --list-different --write ${results.join(' ')}` : '';
};

const buildLintCommand = filenames => {
  const results = filenames
    .map(f => path.relative(process.cwd(), f))
    .filter(f => !ignoredFiles.includes(f));

  return results.length ? `eslint --cache ${results.join(' ')}` : '';
};

module.exports = {
  '*.{css,js,json,scss,ts,tsx}': [buildFormatCommand, buildLintCommand],
};
