const { ESLint } = require('eslint');

const removeIgnoredFiles = async files => {
  const eslint = new ESLint();
  const isIgnored = await Promise.all(
    files.map(file => {
      return eslint.isPathIgnored(file);
    })
  );
  const filteredFiles = files.filter((_, i) => !isIgnored[i]);
  return filteredFiles.join(' ');
};

const buildFormatCommand = async files => {
  const filesToLint = await removeIgnoredFiles(files);

  if (!filesToLint || !filesToLint.length) {
    return '';
  }

  const results = filesToLint.map(f => path.relative(process.cwd(), f));

  return results.length
    ? `prettier --ignore-unknown --list-different --write ${results.join(' ')}`
    : '';
};

const buildLintCommand = async files => {
  const filesToLint = await removeIgnoredFiles(files);

  if (!filesToLint || !filesToLint.length) {
    return '';
  }

  const results = filesToLint.map(f => path.relative(process.cwd(), f));

  return results.length ? `eslint --cache ${results.join(' ')}` : '';
};

module.exports = {
  '*.{css,js,json,scss,ts,tsx}': [buildFormatCommand, buildLintCommand],
};
