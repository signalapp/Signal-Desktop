// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as fs from 'node:fs';
import OS from './os/osMain.node.js';

const ZONE_IDENTIFIER_CONTENTS = Buffer.from('[ZoneTransfer]\r\nZoneId=3');

/**
 * Internet Explorer introduced the concept of "Security Zones". For our purposes, we
 * just need to set the security zone to the "Internet" zone, which Windows will use to
 * offer some protections. This is customizable by the user (or, more likely, by IT).
 *
 * To do this, we write the "Zone.Identifier" for the NTFS alternative data stream.
 *
 * This can fail in a bunch of situations:
 *
 * - The OS is not Windows.
 * - The filesystem is not NTFS.
 * - Writing the metadata file fails for some reason (permissions, for example).
 * - The metadata file already exists. (We could choose to overwrite it.)
 * - The original file is deleted between the time that we check for its existence and
 *   when we write the metadata. This is a rare race condition, but is possible.
 *
 * Consumers of this module should probably tolerate failures.
 */
export async function writeWindowsZoneIdentifier(
  filePath: string
): Promise<void> {
  if (!OS.isWindows()) {
    throw new Error('writeWindowsZoneIdentifier should only run on Windows');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(
      'writeWindowsZoneIdentifier could not find the original file'
    );
  }

  await fs.promises.writeFile(
    `${filePath}:Zone.Identifier`,
    ZONE_IDENTIFIER_CONTENTS,
    {
      flag: 'wx',
    }
  );
}
