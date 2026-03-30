// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { parseIntOrThrow } from '../util/parseIntOrThrow.std.ts';
import type { ConfigKeyType } from '../RemoteConfig.dom.ts';
import { getValue } from '../RemoteConfig.dom.ts';

const { isNumber } = lodash;

function makeGetter(configKey: ConfigKeyType): (fallback?: number) => number {
  return fallback => {
    try {
      return parseIntOrThrow(
        getValue(configKey),
        `Failed to parse ${configKey} as an integer`
      );
    } catch (err) {
      if (isNumber(fallback)) {
        return fallback;
      }
      throw err;
    }
  };
}

export const getGroupSizeRecommendedLimit = makeGetter(
  'global.groupsv2.maxGroupSize'
);

export const getGroupSizeHardLimit = makeGetter(
  'global.groupsv2.groupSizeHardLimit'
);
