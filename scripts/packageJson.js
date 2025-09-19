// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PACKAGE_JSON_PATH = join(__dirname, '..', 'package.json');

const json = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));

exports.default = json;
exports.name = json.name;
exports.version = json.version;
exports.productName = json.productName;
exports.build = json.build;
