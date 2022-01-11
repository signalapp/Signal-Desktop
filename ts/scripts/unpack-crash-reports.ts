// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'fs/promises';
import path from 'path';

import { SignalService as Proto } from '../protobuf';

async function main(fileName: string, outDir: string) {
  await fs.mkdir(outDir, { recursive: true });

  const encoded = await fs.readFile(fileName);
  const { reports } = Proto.CrashReportList.decode(encoded);

  await Promise.all(
    reports.map(async ({ filename, content }) => {
      if (!filename || !content) {
        return;
      }

      const outFile = path.join(outDir, path.basename(filename));
      console.log(`Extracting to ${outFile}`);
      await fs.writeFile(outFile, content);
    })
  );
}

main(process.argv[2], process.argv[3]).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
