// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import fastGlob from 'fast-glob';
import { gte } from 'semver';
import { Format, NtExecutable } from 'pe-library';
import packageJson from '../package.json' with { type: 'json' };

// Note: because we don't run under electron - this is a path to binary
import electronImport from 'electron';
const ELECTRON_BINARY = /** @type {string} */ (
  /** @type {unknown} */ (electronImport)
);

const { ImageDosHeader, ImageNtHeaders, ImageDirectoryEntry } = Format;

const execFile = promisify(execFileCb);

// See https://en.wikipedia.org/wiki/Darwin_(operating_system)#Darwin_20_onwards
const MACOS_TO_DARWIN_VERSIONS = new Map([
  // Big Sur
  ['11.0', '20.1.0'],
  ['11.1', '20.2.0'],
  ['11.2', '20.3.0'],
  ['11.3', '20.4.0'],
  ['11.4', '20.5.0'],

  // Monterey
  ['12.0', '21.0.1'],
  ['12.0.1', '21.1.0'],
  ['12.1', '21.2.0'],
  ['12.2', '21.3.0'],
  ['12.3', '21.4.0'],
  ['12.4', '21.5.0'],
  ['12.5', '21.6.0'],

  // Ventura
  ['13.0', '22.1.0'],
  ['13.1', '22.2.0'],
  ['13.2', '22.3.0'],
  ['13.3', '22.4.0'],
  ['13.4', '22.5.0'],
  ['13.5', '22.6.0'],

  // Sonoma
  ['14.0', '23.0.0'],
  ['14.1', '23.1.0'],
  ['14.2', '23.2.0'],
  ['14.3', '23.3.0'],
  ['14.4', '23.4.0'],
  ['14.5', '23.5.0'],

  // Sequoia
  ['15.0', '24.0.0'],

  // Tahoe
  ['26.0', '25.0.0'],
]);

/**
 * @param {string} file
 */
async function macosVersionCheck(file) {
  console.log(`${file}: checking...`);

  const { stdout } = await execFile('otool', ['-l', file]);

  const match = stdout.match(/minos\s+([\d.]+)/);
  if (match == null) {
    throw new Error(`Failed to detect min OS version of ${file}`);
  }

  const [, macosVersion] = match;
  if (macosVersion == null) {
    throw new Error('Missing macosVersion');
  }
  const darwinVersion = MACOS_TO_DARWIN_VERSIONS.get(macosVersion);
  if (darwinVersion == null) {
    throw new Error(`No matching darwin version for macOS ${macosVersion}`);
  }

  const minSupported = packageJson.build.mac.releaseInfo.vendor.minOSVersion;
  if (gte(minSupported, darwinVersion)) {
    console.log(`${file}: required version ${darwinVersion}`);
    return;
  }

  throw new Error(
    `${basename(file)} minimum darwin version is ${darwinVersion} ` +
      `(macOS ${macosVersion}), but package.json has ${minSupported}`
  );
}

// See: https://learn.microsoft.com/en-us/windows/win32/debug/pe-format?redirectedfrom=MSDN
// See: https://0xrick.github.io/win-internals/pe6/
const EMPTY_IMPORT_ENTRY = Buffer.alloc(4 * 5);
const EMPTY_DELAY_IMPORT_ENTRY = Buffer.alloc(4 * 8);

const DLL_TABLES = new Map([
  // https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#import-directory-table
  [ImageDirectoryEntry.Import, { empty: EMPTY_IMPORT_ENTRY, nameOffset: 12 }],
  // https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#the-delay-load-directory-table
  [
    ImageDirectoryEntry.DelayImport,
    { empty: EMPTY_DELAY_IMPORT_ENTRY, nameOffset: 4 },
  ],
]);

const ALLOWED_DLLS = new Set([
  'advapi32.dll',
  'api-ms-win-core-handle-l1-1-0.dll',
  'api-ms-win-core-realtime-l1-1-1.dll',
  'api-ms-win-core-synch-l1-2-0.dll',
  'api-ms-win-core-winrt-error-l1-1-1.dll',
  'api-ms-win-core-winrt-l1-1-0.dll',
  'api-ms-win-core-winrt-string-l1-1-0.dll',
  'api-ms-win-power-base-l1-1-0.dll',
  'api-ms-win-shcore-scaling-l1-1-1.dll',
  'avrt.dll',
  'bcrypt.dll',
  'bcryptprimitives.dll',
  'bthprops.cpl',
  'cfgmgr32.dll',
  'comctl32.dll',
  'comdlg32.dll',
  'crypt32.dll',
  'd3d11.dll',
  'd3d12.dll',
  'dbghelp.dll',
  'dcomp.dll',
  'dhcpcsvc.dll',
  'dwmapi.dll',
  'dwrite.dll',
  'dxgi.dll',
  'ffmpeg.dll',
  'fontsub.dll',
  'gdi32.dll',
  'hid.dll',
  'iphlpapi.dll',
  'kernel32.dll',
  'mf.dll',
  'mfplat.dll',
  'mfreadwrite.dll',
  'mmdevapi.dll',
  'msdmo.dll',
  'ncrypt.dll',
  'node.exe',
  'ntdll.dll',
  'ole32.dll',
  'oleacc.dll',
  'oleaut32.dll',
  'pdh.dll',
  'powrprof.dll',
  'propsys.dll',
  'psapi.dll',
  'rpcrt4.dll',
  'secur32.dll',
  'setupapi.dll',
  'shell32.dll',
  'shlwapi.dll',
  'uiautomationcore.dll',
  'urlmon.dll',
  'user32.dll',
  'userenv.dll',
  'uxtheme.dll',
  'version.dll',
  'winhttp.dll',
  'winmm.dll',
  'winspool.drv',
  'wintrust.dll',
  'winusb.dll',
  'ws2_32.dll',
  'wtsapi32.dll',
]);

/**
 * @param {string} file
 * @returns {Promise<void>}
 */
async function windowsDllImportCheck(file) {
  console.log(`${file}: checking...`);

  const fileData = await readFile(file);
  const dosHeader = ImageDosHeader.from(fileData);
  const ntHeaders = ImageNtHeaders.from(fileData, dosHeader.newHeaderAddress);

  const ntExecutable = NtExecutable.from(fileData, {
    ignoreCert: true,
  });

  /**
   * @param {Buffer<ArrayBuffer>} data
   * @param {number} offset
   * @returns {string}
   */
  function cstr(data, offset) {
    for (let end = offset; end < data.length; end += 1) {
      if (data[end] === 0) {
        return data.subarray(offset, end).toString();
      }
    }
    throw new Error('Invalid cstring');
  }

  /** @type {Set<string>} */
  const imports = new Set();
  for (const [entryType, { empty, nameOffset }] of DLL_TABLES) {
    const section = ntExecutable.getSectionByEntry(entryType);
    const imageDirectoryEntry =
      ntHeaders.optionalHeaderDataDirectory.get(entryType);

    if (section?.data == null || imageDirectoryEntry == null) {
      console.warn(`${file}: no ${entryType} directory entry`);
      continue;
    }

    // section contains the directory entry, but at offset determined by the
    // image directory entry
    const entryData = Buffer.from(section.data).subarray(
      imageDirectoryEntry.virtualAddress - section.info.virtualAddress
    );

    for (let i = 0; i < entryData.byteLength; i += empty.byteLength) {
      const entry = entryData.subarray(i, i + empty.byteLength);

      // Empty descriptor indicates end of the array
      if (entry.equals(empty)) {
        break;
      }

      const name = entry.readInt32LE(nameOffset);

      if (name <= 0) {
        continue;
      }
      imports.add(
        cstr(
          fileData,
          // `name` is offest relative to loaded section, translate it back
          // to the file offset
          name - section.info.virtualAddress + section.info.pointerToRawData
        ).toLowerCase()
      );
    }
  }

  let disallowed = 0;
  for (const name of imports) {
    if (ALLOWED_DLLS.has(name)) {
      console.log(`  Allowed: ${name}`);
    } else {
      console.error(`  Disallowed: ${name}`);
      disallowed += 1;
    }
  }

  if (disallowed !== 0) {
    throw new Error(`${basename(file)} contains disallowed dll imports`);
  }
}

/**
 * @param {string} version
 */
function padGlibcVersion(version) {
  if (/^\d+\.\d+$/.test(version)) {
    return `${version}.0`;
  }
  if (/^\d+\.\d+\.\d+$/.test(version)) {
    return version;
  }
  throw new Error(`Unsupported glibc version: ${version}`);
}

/**
 * @param {string} file
 */
async function linuxVersionCheck(file) {
  if (!existsSync(file)) {
    console.log(`${file}: skipping`);
    return;
  }

  console.log(`${file}: checking...`);

  const { stdout } = await execFile('objdump', ['-T', file], {
    maxBuffer: 100 * 1024 * 1024,
  });

  /** @type {string | undefined} */
  let minGlibcVersion;
  for (const match of stdout.matchAll(/GLIBC_([\d.]+)/g)) {
    const [, unpaddedVersion] = match;
    if (unpaddedVersion == null) {
      throw new Error('Missing unpaddedVersion');
    }
    const glibcVersion = padGlibcVersion(unpaddedVersion);
    if (minGlibcVersion == null || gte(glibcVersion, minGlibcVersion)) {
      minGlibcVersion = glibcVersion;
    }
  }

  if (minGlibcVersion == null) {
    throw new Error(`Failed to detect glibc versions of ${file}`);
  }

  const libc6Dependency = packageJson.build.deb.depends.find(req =>
    req.startsWith('libc6 ')
  );
  if (libc6Dependency == null) {
    throw new Error('Missing libc6 dependency in package.json');
  }

  const match = libc6Dependency.match(/^libc6 \(>= ([\d.]+)\)$/);
  if (match == null) {
    throw new Error(
      `Invalid libc6 dependency in package.json, ${libc6Dependency}`
    );
  }

  const [, unpaddedVersion] = match;
  if (unpaddedVersion == null) {
    throw new Error('Missing unpaddedVersion');
  }
  const minSupported = padGlibcVersion(unpaddedVersion);
  if (gte(minSupported, minGlibcVersion)) {
    console.log(`${file}: required version ${minGlibcVersion}`);
    return;
  }

  throw new Error(
    `${basename(file)} minimum GLIBC version is ${minGlibcVersion} ` +
      `but package.json has ${libc6Dependency}`
  );
}

/** @type {string[]} */
const BINARY_FILES = [
  ELECTRON_BINARY,
  ...(await fastGlob(
    packageJson.build.files
      .filter(p => typeof p === 'string')
      .filter(p => p.endsWith('.node'))
      .map(p => p.replace(/\${platform}/, process.platform))
      .map(p => p.replace(/\${arch}/, process.arch)),
    {
      absolute: true,
      onlyFiles: true,
      cwd: join(import.meta.dirname, '..'),
    }
  )),
];
for (const file of BINARY_FILES) {
  if (process.platform === 'darwin') {
    // oxlint-disable-next-line no-await-in-loop
    await macosVersionCheck(file);
  } else if (process.platform === 'win32') {
    // oxlint-disable-next-line no-await-in-loop
    await windowsDllImportCheck(file);
  } else if (process.platform === 'linux') {
    // oxlint-disable-next-line no-await-in-loop
    await linuxVersionCheck(file);
  }
}
