// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

// Checks that Electron and the prebuilt native modules of every platform we
// ship don't need a newer OS than package.json declares.

import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { unzipSync } from 'fflate';
import * as YAML from 'js-yaml';
import * as semver from 'semver';
import { Parser } from 'tar';
import packageJson from '../../../package.json' with { type: 'json' };

/** @typedef {'darwin' | 'win32' | 'linux'} Platform */
/** @typedef {'x64' | 'arm64'} Arch */
/** @typedef {Readonly<{ platform: Platform, arch: Arch }>} Target */
/** @typedef {ReadonlyMap<string, Buffer>} FileMap */
/** @typedef {Readonly<{ version: string, integrity: string, tarball: string }>} LockedPackage */
/** @typedef {Readonly<{ darwin: string, glibc: string }>} MinimumVersions */
/** @typedef {Readonly<{ name: string, pathPattern: string }>} NativeModulePattern */

const ROOT_DIR = join(import.meta.dirname, '..', '..', '..');
const execFile = promisify(execFileCallback);

/** @type {ReadonlyArray<Target>} */
const ALL_TARGETS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'win32', arch: 'arm64' },
  { platform: 'win32', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'linux', arch: 'x64' },
];

// See https://en.wikipedia.org/wiki/Darwin_(operating_system)#Darwin_20_onwards
const MACOS_TO_DARWIN_VERSIONS = new Map([
  ['11.0', '20.1.0'],
  ['11.1', '20.2.0'],
  ['11.2', '20.3.0'],
  ['11.3', '20.4.0'],
  ['11.4', '20.5.0'],
  ['12.0', '21.0.1'],
  ['12.0.1', '21.1.0'],
  ['12.1', '21.2.0'],
  ['12.2', '21.3.0'],
  ['12.3', '21.4.0'],
  ['12.4', '21.5.0'],
  ['12.5', '21.6.0'],
  ['13.0', '22.1.0'],
  ['13.1', '22.2.0'],
  ['13.2', '22.3.0'],
  ['13.3', '22.4.0'],
  ['13.4', '22.5.0'],
  ['13.5', '22.6.0'],
  ['14.0', '23.0.0'],
  ['14.1', '23.1.0'],
  ['14.2', '23.2.0'],
  ['14.3', '23.3.0'],
  ['14.4', '23.4.0'],
  ['14.5', '23.5.0'],
  ['15.0', '24.0.0'],
  ['26.0', '25.0.0'],
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
  'cryptui.dll',
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
  'tbs.dll',
  'uiautomationcore.dll',
  'urlmon.dll',
  'user32.dll',
  'userenv.dll',
  'uxtheme.dll',
  'version.dll',
  'wevtapi.dll',
  'winhttp.dll',
  'winmm.dll',
  'winspool.drv',
  'wintrust.dll',
  'winusb.dll',
  'ws2_32.dll',
  'wtsapi32.dll',
]);

/**
 * @param {never} value
 * @returns {Error}
 */
function missingCaseError(value) {
  return new Error(`Unhandled case: ${value}`);
}

/**
 * Parses versions like `2.34` that aren't full semver.
 * @param {string} version
 * @returns {semver.SemVer}
 */
function parseVersion(version) {
  const parsed = semver.coerce(version);
  if (parsed == null) {
    throw new Error(`Invalid version: ${version}`);
  }
  return parsed;
}

/**
 * @param {Buffer} data
 * @param {number} offset
 * @returns {string}
 */
function readCString(data, offset) {
  const end = data.indexOf(0, offset);
  if (end === -1) {
    throw new Error('Unterminated string');
  }
  return data.toString('latin1', offset, end);
}

/**
 * @param {string} url
 * @param {(data: Buffer) => boolean} isValid
 * @returns {Promise<Buffer>}
 */
async function download(url, isValid) {
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!isValid(data)) {
    throw new Error(`Checksum mismatch for ${url}`);
  }
  return data;
}

/**
 * @param {string} integrity e.g. `sha512-...`
 * @returns {(data: Buffer) => boolean}
 */
function hasIntegrity(integrity) {
  const [algorithm, expected] = integrity.split('-', 2);
  if (algorithm == null || expected == null) {
    throw new Error(`Invalid integrity: ${integrity}`);
  }
  return data => {
    return createHash(algorithm).update(data).digest('base64') === expected;
  };
}

/**
 * @param {string} sha256 Hex digest
 * @returns {(data: Buffer) => boolean}
 */
function hasSha256(sha256) {
  return data => {
    return createHash('sha256').update(data).digest('hex') === sha256;
  };
}

/**
 * @param {Buffer} archive
 * @returns {FileMap}
 */
function extractTarGz(archive) {
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  // Parses synchronously, so every entry has ended once end() returns
  const parser = new Parser({
    strict: true,
    onReadEntry: entry => {
      if (entry.type !== 'File') {
        entry.resume();
        return;
      }
      /** @type {Array<Buffer>} */
      const chunks = [];
      entry.on('data', chunk => {
        chunks.push(chunk);
      });
      entry.on('end', () => {
        files.set(posix.normalize(entry.path), Buffer.concat(chunks));
      });
    },
  });
  parser.end(archive);
  return files;
}

/**
 * @param {Buffer} archive
 * @param {string} path
 * @returns {Buffer}
 */
function extractZipEntry(archive, path) {
  const files = unzipSync(archive, {
    filter: file => {
      return file.name === path;
    },
  });
  const data = files[path];
  if (data == null) {
    throw new Error(`Missing ${path} in zip`);
  }
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * @param {string} text
 * @returns {any}
 */
function parseLockfile(text) {
  // pnpm-lock.yaml has a document for pnpm itself before the app's document
  const document = YAML.loadAll(text).find(
    /** @param {any} doc */ doc => {
      return doc?.importers?.['.']?.dependencies != null;
    }
  );
  if (document == null) {
    throw new Error('Missing root importer in pnpm-lock.yaml');
  }
  return document;
}

/**
 * Returns a root dependency's locked package, or null for workspace packages.
 * @param {any} lock
 * @param {string} name
 * @returns {LockedPackage | null}
 */
function getLockedPackage(lock, name) {
  const importer = lock.importers['.'];
  const dependency =
    importer.dependencies?.[name] ??
    importer.devDependencies?.[name] ??
    importer.optionalDependencies?.[name];
  if (dependency == null) {
    throw new Error(`Missing ${name} in pnpm-lock.yaml`);
  }
  // Drops the peer suffix, e.g. `45.2.1(supports-color@8.1.1)`
  /** @type {string} */
  const version = dependency.version.replace(/\(.*$/, '');
  if (version.startsWith('link:')) {
    return null;
  }
  const resolution = lock.packages[`${name}@${version}`]?.resolution;
  if (
    resolution == null ||
    resolution.integrity == null ||
    resolution.tarball == null
  ) {
    throw new Error(`Missing resolution for ${name}@${version}`);
  }
  return {
    version,
    integrity: resolution.integrity,
    tarball: resolution.tarball,
  };
}

/**
 * @param {any} pkg
 * @returns {MinimumVersions}
 */
function getMinimumVersions(pkg) {
  const darwin = pkg.build.mac.releaseInfo.vendor.minOSVersion;
  let glibc = null;
  for (const dependency of pkg.build.deb.depends) {
    const match = dependency.match(/^libc6 \(>= ([\d.]+)\)$/);
    if (match != null) {
      glibc = match[1];
    }
  }
  if (glibc == null) {
    throw new Error('Missing libc6 dependency in package.json');
  }
  return { darwin, glibc };
}

/**
 * Returns the `.node` patterns in `build.files`, split into the package name
 * and the path inside the package.
 * @param {any} pkg
 * @returns {ReadonlyArray<NativeModulePattern>}
 */
function getNativeModulePatterns(pkg) {
  /** @type {Array<NativeModulePattern>} */
  const patterns = [];
  for (const pattern of pkg.build.files) {
    if (typeof pattern !== 'string' || !pattern.endsWith('.node')) {
      continue;
    }
    const match = pattern.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)\/(.*)$/);
    if (match == null || match[1] == null || match[2] == null) {
      throw new Error(`Unexpected native module pattern: ${pattern}`);
    }
    patterns.push({ name: match[1], pathPattern: match[2] });
  }
  return patterns;
}

const lockfile = parseLockfile(
  await readFile(join(ROOT_DIR, 'pnpm-lock.yaml'), 'utf8')
);

/**
 * @param {LockedPackage} lockedPackage
 * @returns {Promise<FileMap>}
 */
async function downloadPackage(lockedPackage) {
  const archive = await download(
    lockedPackage.tarball,
    hasIntegrity(lockedPackage.integrity)
  );
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  for (const [path, data] of extractTarGz(archive)) {
    files.set(path.replace(/^package\//, ''), data);
  }

  const packageJsonFile = files.get('package.json');
  if (packageJsonFile == null) {
    throw new Error(`Missing package.json in ${lockedPackage.tarball}`);
  }
  // ringrtc's install script downloads its binaries from this pinned URL
  const config = JSON.parse(packageJsonFile.toString()).config;
  if (config?.prebuildUrl != null && config.prebuildChecksum != null) {
    const prebuildUrl = config.prebuildUrl.replace(
      '${npm_package_version}', // oxlint-disable-line eslint/no-template-curly-in-string
      lockedPackage.version
    );
    const prebuild = await download(
      prebuildUrl,
      hasSha256(config.prebuildChecksum)
    );
    for (const [path, data] of extractTarGz(prebuild)) {
      files.set(path, data);
    }
  }
  return files;
}

/** @type {Map<string, Promise<FileMap | null>>} */
const packageFilesCache = new Map();

/**
 * Returns the files of a root dependency, or null for workspace packages.
 * @param {string} name
 * @returns {Promise<FileMap | null>}
 */
function getPackageFiles(name) {
  let result = packageFilesCache.get(name);
  if (result == null) {
    const lockedPackage = getLockedPackage(lockfile, name);
    if (lockedPackage == null) {
      result = Promise.resolve(null);
    } else {
      result = downloadPackage(lockedPackage);
    }
    packageFilesCache.set(name, result);
  }
  return result;
}

/**
 * @param {Platform} platform
 * @returns {string}
 */
function getElectronExecutablePath(platform) {
  if (platform === 'darwin') {
    return 'Electron.app/Contents/MacOS/Electron';
  }
  if (platform === 'win32') {
    return 'electron.exe';
  }
  if (platform === 'linux') {
    return 'electron';
  }
  throw missingCaseError(platform);
}

/**
 * @param {Target} target
 * @returns {Promise<ReadonlyArray<[string, Buffer]>>}
 */
async function getElectronBinary(target) {
  const lockedPackage = getLockedPackage(lockfile, 'electron');
  const files = await getPackageFiles('electron');
  if (lockedPackage == null || files == null) {
    throw new Error('Electron must be installed from npm');
  }
  const checksumsFile = files.get('checksums.json');
  if (checksumsFile == null) {
    throw new Error('Missing checksums.json in electron');
  }
  const { version } = lockedPackage;
  const zipName = `electron-v${version}-${target.platform}-${target.arch}.zip`;
  const sha256 = JSON.parse(checksumsFile.toString())[zipName];
  if (sha256 == null) {
    throw new Error(`Missing checksum for ${zipName}`);
  }
  const zip = await download(
    `https://github.com/electron/electron/releases/download/v${version}/${zipName}`,
    hasSha256(sha256)
  );
  const executablePath = getElectronExecutablePath(target.platform);
  return [
    [`${zipName}/${executablePath}`, extractZipEntry(zip, executablePath)],
  ];
}

/**
 * Patterns without `${platform}` or `${arch}` are built from source in CI.
 * @param {NativeModulePattern} pattern
 * @returns {boolean}
 */
function isPrebuilt(pattern) {
  return /\$\{(platform|arch)\}/.test(pattern.pathPattern);
}

/**
 * @param {NativeModulePattern} pattern
 * @param {Target} target
 * @returns {RegExp}
 */
function getPathRegExp(pattern, target) {
  const path = pattern.pathPattern
    .replaceAll('${platform}', target.platform) // oxlint-disable-line eslint/no-template-curly-in-string
    .replaceAll('${arch}', target.arch) // oxlint-disable-line eslint/no-template-curly-in-string
    .replace(/[.+?^$()|[\]\\{}]/g, '\\$&')
    .replaceAll('*', '[^/]*');
  return new RegExp(`^${path}$`);
}

/**
 * Returns an error for each prebuilt pattern that matches no file on any
 * target, so a renamed prebuild directory can't make the check pass.
 * @returns {Promise<ReadonlyArray<string>>}
 */
async function checkNativeModulePatterns() {
  /** @type {Array<string>} */
  const errors = [];
  for (const pattern of getNativeModulePatterns(packageJson)) {
    if (!isPrebuilt(pattern)) {
      console.log(`Skipping ${pattern.name}, built from source`);
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop
    const files = await getPackageFiles(pattern.name);
    if (files == null) {
      errors.push(`${pattern.name} is a workspace package with prebuilds`);
      continue;
    }
    let matched = false;
    for (const target of ALL_TARGETS) {
      const pathRegExp = getPathRegExp(pattern, target);
      for (const path of files.keys()) {
        if (pathRegExp.test(path)) {
          matched = true;
        }
      }
    }
    if (!matched) {
      errors.push(
        `${pattern.name}/${pattern.pathPattern} matches no file on any target`
      );
    }
  }
  return errors;
}

/**
 * Returns the prebuilt `.node` files that `build.files` ships for the target.
 * @param {Target} target
 * @returns {Promise<ReadonlyArray<[string, Buffer]>>}
 */
async function getNativeModules(target) {
  /** @type {Array<NativeModulePattern>} */
  const patterns = [];
  for (const pattern of getNativeModulePatterns(packageJson)) {
    if (isPrebuilt(pattern)) {
      patterns.push(pattern);
    }
  }
  const filesByPattern = await Promise.all(
    patterns.map(pattern => {
      return getPackageFiles(pattern.name);
    })
  );

  /** @type {Array<[string, Buffer]>} */
  const binaries = [];
  for (const [index, pattern] of patterns.entries()) {
    const files = filesByPattern[index];
    if (files == null) {
      continue;
    }
    const pathRegExp = getPathRegExp(pattern, target);
    for (const [path, data] of files) {
      if (pathRegExp.test(path)) {
        binaries.push([`${pattern.name}/${path}`, data]);
      }
    }
  }
  return binaries;
}

/**
 * @param {Buffer} data
 * @returns {ReadonlyArray<string>} One macOS version per architecture slice
 */
function getMachOMinVersions(data) {
  if (data.readUInt32BE(0) === 0xcafebabe) {
    /** @type {Array<string>} */
    const versions = [];
    const sliceCount = data.readUInt32BE(4);
    for (let i = 0; i < sliceCount; i += 1) {
      const entry = 8 + i * 20;
      const offset = data.readUInt32BE(entry + 8);
      const size = data.readUInt32BE(entry + 12);
      versions.push(
        ...getMachOMinVersions(data.subarray(offset, offset + size))
      );
    }
    return versions;
  }
  if (data.readUInt32LE(0) !== 0xfeedfacf) {
    throw new Error('Not a 64-bit Mach-O binary');
  }

  const LC_VERSION_MIN_MACOSX = 0x24;
  const LC_BUILD_VERSION = 0x32;
  const commandCount = data.readUInt32LE(16);
  let offset = 32;
  for (let i = 0; i < commandCount; i += 1) {
    const command = data.readUInt32LE(offset);
    let version = null;
    if (command === LC_BUILD_VERSION) {
      version = data.readUInt32LE(offset + 12);
    } else if (command === LC_VERSION_MIN_MACOSX) {
      version = data.readUInt32LE(offset + 8);
    }
    if (version != null) {
      // oxlint-disable-next-line no-bitwise
      const major = version >>> 16;
      // oxlint-disable-next-line no-bitwise
      const minor = (version >>> 8) & 0xff;
      // oxlint-disable-next-line no-bitwise
      const patch = version & 0xff;
      return [patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`];
    }
    offset += data.readUInt32LE(offset + 4);
  }
  throw new Error('Missing minimum macOS version');
}

/**
 * @param {string} macosVersion
 * @returns {string | null}
 */
function getDarwinVersion(macosVersion) {
  const [major, minor] = macosVersion.split('.').map(Number);
  // macOS 10.x is darwin (x + 4)
  if (major === 10 && minor != null) {
    return `${minor + 4}.0.0`;
  }
  return MACOS_TO_DARWIN_VERSIONS.get(macosVersion) ?? null;
}

/**
 * @param {Buffer} data
 * @param {string} minimumDarwin
 * @returns {ReadonlyArray<string>}
 */
function checkMacOS(data, minimumDarwin) {
  /** @type {Array<string>} */
  const errors = [];
  for (const macosVersion of getMachOMinVersions(data)) {
    const darwinVersion = getDarwinVersion(macosVersion);
    if (darwinVersion == null) {
      errors.push(`No matching darwin version for macOS ${macosVersion}`);
    } else if (semver.lt(minimumDarwin, darwinVersion)) {
      errors.push(
        `Requires darwin ${darwinVersion} (macOS ${macosVersion}), ` +
          `but package.json has ${minimumDarwin}`
      );
    } else {
      console.log(`  requires darwin ${darwinVersion} (macOS ${macosVersion})`);
    }
  }
  return errors;
}

/**
 * See https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
 * @param {Buffer} data
 * @returns {ReadonlySet<string>}
 */
function getPEImports(data) {
  const peOffset = data.readUInt32LE(0x3c);
  if (data.readUInt32LE(peOffset) !== 0x00004550) {
    throw new Error('Not a PE binary');
  }
  const sectionCount = data.readUInt16LE(peOffset + 6);
  const optionalHeaderSize = data.readUInt16LE(peOffset + 20);
  const optionalHeader = peOffset + 24;
  const isPE32Plus = data.readUInt16LE(optionalHeader) === 0x20b;
  const imageBase = isPE32Plus
    ? Number(data.readBigUInt64LE(optionalHeader + 24))
    : data.readUInt32LE(optionalHeader + 28);
  const dataDirectories = optionalHeader + (isPE32Plus ? 112 : 96);
  const sectionTable = optionalHeader + optionalHeaderSize;

  /** @param {number} rva */
  function rvaToOffset(rva) {
    for (let i = 0; i < sectionCount; i += 1) {
      const section = sectionTable + i * 40;
      const virtualSize = data.readUInt32LE(section + 8);
      const virtualAddress = data.readUInt32LE(section + 12);
      if (rva >= virtualAddress && rva < virtualAddress + virtualSize) {
        return rva - virtualAddress + data.readUInt32LE(section + 20);
      }
    }
    throw new Error(`RVA ${rva} is outside of every section`);
  }

  /** @type {Set<string>} */
  const imports = new Set();

  const importTable = data.readUInt32LE(dataDirectories + 8);
  if (importTable !== 0) {
    for (let entry = rvaToOffset(importTable); ; entry += 20) {
      const nameRva = data.readUInt32LE(entry + 12);
      if (nameRva === 0) {
        break;
      }
      imports.add(readCString(data, rvaToOffset(nameRva)).toLowerCase());
    }
  }

  const delayImportTable = data.readUInt32LE(dataDirectories + 13 * 8);
  if (delayImportTable !== 0) {
    for (let entry = rvaToOffset(delayImportTable); ; entry += 32) {
      // Old delay-load entries hold virtual addresses instead of RVAs
      // oxlint-disable-next-line no-bitwise
      const usesRvas = (data.readUInt32LE(entry) & 1) === 1;
      const name = data.readUInt32LE(entry + 4);
      if (name === 0) {
        break;
      }
      const nameRva = usesRvas ? name : name - imageBase;
      imports.add(readCString(data, rvaToOffset(nameRva)).toLowerCase());
    }
  }

  return imports;
}

/**
 * @param {Buffer} data
 * @returns {ReadonlyArray<string>}
 */
function checkWindows(data) {
  /** @type {Array<string>} */
  const errors = [];
  for (const name of getPEImports(data)) {
    if (!ALLOWED_DLLS.has(name)) {
      errors.push(`Imports disallowed dll ${name}`);
    }
  }
  return errors;
}

/**
 * Returns the versions in `.gnu.version_r`, which the dynamic linker checks.
 * @param {Buffer} data
 * @returns {ReadonlyArray<string>}
 */
function getElfVersionNeeds(data) {
  if (data.readUInt32BE(0) !== 0x7f454c46 || data[4] !== 2 || data[5] !== 1) {
    throw new Error('Not a 64-bit little-endian ELF binary');
  }
  const SHT_GNU_VERNEED = 0x6ffffffe;
  const sectionTable = Number(data.readBigUInt64LE(0x28));
  const sectionSize = data.readUInt16LE(0x3a);
  const sectionCount = data.readUInt16LE(0x3c);

  /** @param {number} index */
  function getSection(index) {
    const header = sectionTable + index * sectionSize;
    return {
      type: data.readUInt32LE(header + 4),
      offset: Number(data.readBigUInt64LE(header + 0x18)),
      link: data.readUInt32LE(header + 0x28),
      info: data.readUInt32LE(header + 0x2c),
    };
  }

  /** @type {Array<string>} */
  const versions = [];
  for (let i = 0; i < sectionCount; i += 1) {
    const section = getSection(i);
    if (section.type !== SHT_GNU_VERNEED) {
      continue;
    }
    const strings = getSection(section.link).offset;
    let need = section.offset;
    for (let j = 0; j < section.info; j += 1) {
      const auxCount = data.readUInt16LE(need + 2);
      let aux = need + data.readUInt32LE(need + 8);
      for (let k = 0; k < auxCount; k += 1) {
        versions.push(readCString(data, strings + data.readUInt32LE(aux + 8)));
        aux += data.readUInt32LE(aux + 12);
      }
      need += data.readUInt32LE(need + 12);
    }
  }
  return versions;
}

/**
 * @param {Buffer} data
 * @param {string} minimumGlibc
 * @returns {ReadonlyArray<string>}
 */
function checkLinux(data, minimumGlibc) {
  /** @type {semver.SemVer | null} */
  let requiredGlibc = null;
  for (const version of getElfVersionNeeds(data)) {
    const match = version.match(/^GLIBC_([\d.]+)$/);
    if (match == null || match[1] == null) {
      continue;
    }
    const glibcVersion = parseVersion(match[1]);
    if (requiredGlibc == null || semver.gt(glibcVersion, requiredGlibc)) {
      requiredGlibc = glibcVersion;
    }
  }
  if (requiredGlibc == null) {
    return ['Failed to detect glibc version'];
  }
  if (semver.lt(parseVersion(minimumGlibc), requiredGlibc)) {
    return [
      `Requires glibc ${requiredGlibc.version}, ` +
        `but package.json has libc6 >= ${minimumGlibc}`,
    ];
  }
  console.log(`  requires glibc ${requiredGlibc.version}`);
  return [];
}

/**
 * @param {Target} target
 * @param {Buffer} data
 * @param {MinimumVersions} minimumVersions
 * @returns {ReadonlyArray<string>}
 */
function checkBinary(target, data, minimumVersions) {
  const { platform } = target;
  if (platform === 'darwin') {
    return checkMacOS(data, minimumVersions.darwin);
  }
  if (platform === 'win32') {
    return checkWindows(data);
  }
  if (platform === 'linux') {
    return checkLinux(data, minimumVersions.glibc);
  }
  throw missingCaseError(platform);
}

/**
 * Returns everything in package.json and pnpm-lock.yaml that this check
 * depends on.
 * @param {any} pkg
 * @param {any} lock
 * @returns {Record<string, unknown>}
 */
function getCheckedInputs(pkg, lock) {
  const minimumVersions = getMinimumVersions(pkg);
  const nativeModulePatterns = getNativeModulePatterns(pkg);
  /** @type {Record<string, unknown>} */
  const inputs = { minimumVersions, nativeModulePatterns };

  const names = new Set(['electron']);
  for (const pattern of nativeModulePatterns) {
    names.add(pattern.name);
  }
  for (const name of names) {
    inputs[name] = getLockedPackage(lock, name) ?? 'workspace';
  }
  return inputs;
}

/**
 * @param {string} base
 * @returns {Promise<ReadonlyArray<string>>} The names of changed inputs
 */
async function getChangedInputs(base) {
  /** @param {string} path */
  async function readAtBase(path) {
    const { stdout } = await execFile('git', ['show', `${base}:${path}`], {
      cwd: ROOT_DIR,
      maxBuffer: 256 * 1024 * 1024,
    });
    return stdout;
  }
  const baseInputs = getCheckedInputs(
    JSON.parse(await readAtBase('package.json')),
    parseLockfile(await readAtBase('pnpm-lock.yaml'))
  );
  const headInputs = getCheckedInputs(packageJson, lockfile);

  /** @type {Array<string>} */
  const changed = [];
  const keys = new Set([...Object.keys(baseInputs), ...Object.keys(headInputs)]);
  for (const key of keys) {
    const baseValue = JSON.stringify(baseInputs[key]);
    const headValue = JSON.stringify(headInputs[key]);
    if (baseValue !== headValue) {
      changed.push(key);
    }
  }
  return changed;
}

const { values: args } = parseArgs({ options: { base: { type: 'string' } } });
if (args.base != null) {
  const changed = await getChangedInputs(args.base);
  if (changed.length === 0) {
    console.log(`Nothing this check depends on changed since ${args.base}`);
    process.exit(0);
  }
  console.log(`Changed since ${args.base}: ${changed.join(', ')}`);
}

const minimumVersions = getMinimumVersions(packageJson);
const binariesByTarget = await Promise.all(
  ALL_TARGETS.map(async target => {
    const [electron, nativeModules] = await Promise.all([
      getElectronBinary(target),
      getNativeModules(target),
    ]);
    return { target, binaries: [...electron, ...nativeModules] };
  })
);

let failureCount = 0;
for (const error of await checkNativeModulePatterns()) {
  console.error(`ERROR: ${error}`);
  failureCount += 1;
}
for (const { target, binaries } of binariesByTarget) {
  for (const [path, data] of binaries) {
    console.log(`${target.platform}-${target.arch} ${path}`);
    for (const error of checkBinary(target, data, minimumVersions)) {
      console.error(`  ERROR: ${error}`);
      failureCount += 1;
    }
  }
}
if (failureCount !== 0) {
  console.error(`${failureCount} minimum OS version check(s) failed`);
  process.exit(1);
}
