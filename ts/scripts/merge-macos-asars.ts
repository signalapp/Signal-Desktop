// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync } from 'fs';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { AfterPackContext } from 'electron-builder';
import asar from 'asar';

// See: https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary
const LIPO = process.env.LIPO || 'lipo';

// See: https://github.com/apple-opensource-mirror/llvmCore/blob/0c60489d96c87140db9a6a14c6e82b15f5e5d252/include/llvm/Object/MachOFormat.h#L108-L112
// If binary file starts with one of the following magic numbers - it is most
// likely a a Mach-O file or simply a macOS object file. We use this check to
// detect binding files below.
const MACHO_MAGIC = new Set([
  // 32-bit Mach-O
  0xfeedface, 0xcefaedfe,

  // 64-bit Mach-O
  0xfeedfacf, 0xcffaedfe,

  // Universal
  0xcafebabe, 0xbebafeca,
]);

function toRelativePath(file: string): string {
  return file.replace(/^\//, '');
}

function isDirectory(a: string, file: string): boolean {
  return Boolean('files' in asar.statFile(a, file));
}

export async function afterPack(context: AfterPackContext): Promise<void> {
  const { appOutDir, packager, electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (!appOutDir.includes('mac-universal')) {
    return;
  }

  const { productFilename } = packager.appInfo;
  const arm64 = appOutDir.replace(/--[^-]*$/, '--arm64');
  const x64 = appOutDir.replace(/--[^-]*$/, '--x64');

  const commonPath = path.join('Contents', 'Resources', 'app.asar');
  const archive = path.join(arm64, `${productFilename}.app`, commonPath);
  const otherArchive = path.join(x64, `${productFilename}.app`, commonPath);

  if (!existsSync(archive)) {
    console.info(`${archive} does not exist yet`);
    return;
  }
  if (!existsSync(otherArchive)) {
    console.info(`${otherArchive} does not exist yet`);
    return;
  }

  console.log(`Merging ${archive} and ${otherArchive}`);

  const files = new Set(asar.listPackage(archive).map(toRelativePath));
  const otherFiles = new Set(
    asar.listPackage(otherArchive).map(toRelativePath)
  );

  //
  // Build set of unpacked directories and files
  //

  const unpackedFiles = new Set<string>();

  function buildUnpacked(a: string, fileList: Set<string>): void {
    for (const file of fileList) {
      const stat = asar.statFile(a, file);

      if (!('unpacked' in stat) || !stat.unpacked) {
        continue;
      }

      if ('files' in stat) {
        continue;
      }
      unpackedFiles.add(file);
    }
  }

  buildUnpacked(archive, files);
  buildUnpacked(otherArchive, otherFiles);

  //
  // Build list of files/directories unique to each asar
  //

  const unique = [];
  for (const file of otherFiles) {
    if (!files.has(file)) {
      unique.push(file);
    }
  }

  //
  // Find files with different content
  //

  const bindings = [];
  for (const file of files) {
    if (!otherFiles.has(file)) {
      continue;
    }

    // Skip directories
    if (isDirectory(archive, file)) {
      continue;
    }

    const content = asar.extractFile(archive, file);
    const otherContent = asar.extractFile(otherArchive, file);

    if (content.compare(otherContent) === 0) {
      continue;
    }

    if (!MACHO_MAGIC.has(content.readUInt32LE(0))) {
      throw new Error(`Can't reconcile two non-macho files ${file}`);
    }

    bindings.push(file);
  }

  //
  // Extract both asars and copy unique directories/files from `otherArchive`
  // to extracted `archive`. Then run `lipo` on every shared binding and
  // overwrite original ASARs with the new merged ASAR.
  //
  // The point is - we want electron-builder to find identical ASARs and thus
  // include only a single ASAR in the final build.
  //
  // Once (If) https://github.com/electron/universal/pull/34 lands - we can
  // remove this script and start using optimized version of the process
  // with a single output ASAR instead of two.
  //

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-'));
  const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'other-archive-'));

  try {
    console.log(`Extracting ${archive} to ${dir}`);
    asar.extractAll(archive, dir);

    console.log(`Extracting ${otherArchive} to ${otherDir}`);
    asar.extractAll(otherArchive, otherDir);

    for (const file of unique) {
      const source = path.resolve(otherDir, file);
      const destination = path.resolve(dir, file);

      if (isDirectory(otherArchive, file)) {
        console.log(`Creating unique directory: ${file}`);
        // eslint-disable-next-line no-await-in-loop
        await fs.mkdir(destination, { recursive: true });
        continue;
      }

      console.log(`Copying unique file: ${file}`);
      // eslint-disable-next-line no-await-in-loop
      await fs.mkdir(path.dirname(destination), { recursive: true });
      // eslint-disable-next-line no-await-in-loop
      await fs.copyFile(source, destination);
    }

    for (const binding of bindings) {
      // eslint-disable-next-line no-await-in-loop
      const source = await fs.realpath(path.resolve(otherDir, binding));
      // eslint-disable-next-line no-await-in-loop
      const destination = await fs.realpath(path.resolve(dir, binding));

      console.log(`Merging binding: ${binding}`);
      execFileSync(LIPO, [
        source,
        destination,
        '-create',
        '-output',
        destination,
      ]);
    }

    for (const dest of [archive, otherArchive]) {
      console.log(`Removing ${dest}`);

      // eslint-disable-next-line no-await-in-loop
      await Promise.all([
        fs.rm(dest, { recursive: true }),
        fs.rm(`${dest}.unpacked`, { recursive: true }),
      ]);

      const resolvedUnpack = Array.from(unpackedFiles).map(file =>
        path.join(dir, file)
      );

      console.log(`Overwriting ${dest}`);

      // eslint-disable-next-line no-await-in-loop
      await asar.createPackageWithOptions(dir, dest, {
        unpack: `{${resolvedUnpack.join(',')}}`,
      });
    }

    console.log('Success');
  } finally {
    await Promise.all([
      fs.rm(dir, { recursive: true }),
      fs.rm(otherDir, { recursive: true }),
    ]);
  }
}
