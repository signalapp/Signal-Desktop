// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import type { CallLinkType } from '../types/CallLink.std.ts';
import { strictAssert } from '../util/assert.std.ts';

let callLinksData: ReadonlyArray<CallLinkType>;

export async function loadCallLinks(): Promise<void> {
  callLinksData = await DataReader.getAllCallLinks();
}

export function getCallLinksForRedux(): ReadonlyArray<CallLinkType> {
  strictAssert(callLinksData != null, 'callLinks has not been loaded');
  return callLinksData;
}
