// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client';
import type { CallLinkType } from '../types/CallLink';
import { strictAssert } from '../util/assert';

let callLinksData: ReadonlyArray<CallLinkType>;

export async function loadCallLinks(): Promise<void> {
  callLinksData = await DataReader.getAllCallLinks();
}

export function getCallLinksForRedux(): ReadonlyArray<CallLinkType> {
  strictAssert(callLinksData != null, 'callLinks has not been loaded');
  return callLinksData;
}
