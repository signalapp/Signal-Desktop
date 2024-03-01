// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const assert = require('assert');
const fs = require('fs');
const { join } = require('path');
const pMap = require('p-map');
const prettier = require('prettier');

// During development, you might use local versions of dependencies which are missing
// acknowledgment files. In this case we'll skip rebuilding the acknowledgment files.
// Enable this flag to throw an error.
const REQUIRE_SIGNAL_LIB_FILES = Boolean(process.env.REQUIRE_SIGNAL_LIB_FILES);

const {
  dependencies = {},
  optionalDependencies = {},
} = require('../package.json');

const SIGNAL_LIBS = ['@signalapp/libsignal-client', '@signalapp/ringrtc'];

const SKIPPED_DEPENDENCIES = new Set(SIGNAL_LIBS);

const rootDir = join(__dirname, '..');
const nodeModulesPath = join(rootDir, 'node_modules');
const destinationPath = join(rootDir, 'ACKNOWLEDGMENTS.md');

function isLicenseFileName(fileName) {
  return /^licen[s|c]e/i.test(fileName);
}

async function getMarkdownForDependency(dependencyName) {
  let licenseBody;

  // fs-xattr is an optional dependency that may fail to install (on Windows, most
  //   commonly), so we have a special case for it here. We may need to do something
  //   similar for new optionalDependencies in the future.
  if (dependencyName === 'fs-xattr') {
    licenseBody = 'License: MIT';
  } else {
    const dependencyRootPath = join(nodeModulesPath, dependencyName);

    const licenseFileName = (
      await fs.promises.readdir(dependencyRootPath)
    ).find(isLicenseFileName);

    if (licenseFileName) {
      const licenseFilePath = join(dependencyRootPath, licenseFileName);
      licenseBody = (
        await fs.promises.readFile(licenseFilePath, 'utf8')
      ).trim();
    } else {
      const packageJsonPath = join(dependencyRootPath, 'package.json');
      const { license } = JSON.parse(
        await fs.promises.readFile(packageJsonPath)
      );
      if (!license) {
        throw new Error(`Could not find license for ${dependencyName}`);
      }
      licenseBody = `License: ${license}`;
    }
  }

  return [
    `## ${dependencyName}`,
    '',
    ...licenseBody.split(/\r?\n/).map(line => {
      const trimmed = line.trim();
      if (trimmed) {
        return `    ${trimmed}`;
      }
      return trimmed;
    }),
  ].join('\n');
}

async function getMarkdownForSignalLib(dependencyName) {
  const dependencyRootPath = join(nodeModulesPath, dependencyName);
  const licenseFilePath = join(
    dependencyRootPath,
    'dist',
    'acknowledgments.md'
  );

  let licenseBody;
  try {
    licenseBody = await fs.promises.readFile(licenseFilePath, 'utf8');
  } catch (err) {
    if (err) {
      if (err.code === 'ENOENT' && !REQUIRE_SIGNAL_LIB_FILES) {
        console.warn(
          `Missing acknowledgments file for ${dependencyName}. Skipping generation of acknowledgments.`
        );
        process.exit(0);
      }

      throw err;
    }
  }

  return [
    `# Acknowledgements for ${dependencyName}`,
    '',
    licenseBody.replace(/^# Acknowledgments/, '').trim(),
  ].join('\n');
}

async function main() {
  assert.deepStrictEqual(
    Object.keys(optionalDependencies),
    ['fs-xattr'],
    'Unexpected optionalDependencies when generating acknowledgments file. To ensure that this file is generated deterministically, make sure to special-case it the acknowledgments generation script.'
  );

  const dependencyNames = [
    ...Object.keys(dependencies),
    ...Object.keys(optionalDependencies),
  ]
    .filter(name => !SKIPPED_DEPENDENCIES.has(name))
    .sort();

  const markdownsForDependency = await pMap(
    dependencyNames,
    getMarkdownForDependency,
    // Without this, we may run into "too many open files" errors.
    {
      concurrency: 100,
      timeout: 1000 * 60 * 2,
    }
  );

  // For our libraries copy the respective acknowledgement lists
  const markdownsFromSignalLibs = await pMap(
    SIGNAL_LIBS,
    getMarkdownForSignalLib,
    {
      concurrency: 100,
      timeout: 1000 * 60 * 2,
    }
  );

  const unformattedOutput = [
    '<!-- Copyright 2020 Signal Messenger, LLC -->',
    '<!-- SPDX-License-Identifier: AGPL-3.0-only -->',
    '# Acknowledgments',
    '',
    'Signal Desktop makes use of the following open source projects.',
    '',
    markdownsForDependency.join('\n\n'),
    '',
    '## Kyber Patent License',
    '',
    '<https://csrc.nist.gov/csrc/media/Projects/post-quantum-cryptography/documents/selected-algos-2022/nist-pqc-license-summary-and-excerpts.pdf>',
    '',
    markdownsFromSignalLibs.join('\n\n'),
  ].join('\n');

  const prettierConfig = await prettier.resolveConfig(destinationPath);
  const output = prettier.format(unformattedOutput, {
    ...prettierConfig,
    filepath: destinationPath,
  });

  await fs.promises.writeFile(destinationPath, output);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
