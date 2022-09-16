// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { run } from 'endanger';

import migrateBackboneToRedux from './rules/migrateBackboneToRedux';
import packageJsonVersionsShouldBePinned from './rules/packageJsonVersionsShouldBePinned';

run(migrateBackboneToRedux(), packageJsonVersionsShouldBePinned());
