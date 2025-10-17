// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import fs from 'node:fs';
import { join } from 'node:path';

const PACKAGE_FILE = join(__dirname, '..', '..', 'package.json');

const json = JSON.parse(fs.readFileSync(PACKAGE_FILE, { encoding: 'utf8' }));

json.build.mac.releaseInfo.vendor.noDelay = true;
json.build.win.releaseInfo.vendor.noDelay = true;

fs.writeFileSync(PACKAGE_FILE, JSON.stringify(json, null, '  '));
