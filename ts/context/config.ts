// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RendererConfigType } from '../types/RendererConfig';
import { strictAssert } from '../util/assert';

const params = new URLSearchParams(document.location.search);
const configParam = params.get('config');
strictAssert(typeof configParam === 'string', 'config is not a string');
const config: RendererConfigType = JSON.parse(configParam);

export { config };
