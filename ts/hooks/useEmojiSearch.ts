// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useCallback, useRef } from 'react';

import { data, createSearch } from '../components/emoji/lib';
import type { SearchEmojiListType } from '../components/emoji/lib';
import { drop } from '../util/drop';
import * as log from '../logging/log';

const uninitialized: SearchEmojiListType = data.map(
  ({ short_name: shortName, short_names: shortNames }) => {
    return {
      shortName,
      rank: 0,
      tags: shortNames,
    };
  }
);

const defaultSearch = createSearch(uninitialized);

export function useEmojiSearch(
  locale: string
): ReturnType<typeof createSearch> {
  const searchRef = useRef(defaultSearch);

  useEffect(() => {
    let canceled = false;

    async function run() {
      let result: SearchEmojiListType | undefined;
      try {
        result = await window.SignalContext.getLocalizedEmojiList(locale);
      } catch (error) {
        log.error(`Failed to get localized emoji list for ${locale}`, error);
      }

      // Fallback
      if (result === undefined) {
        try {
          result = await window.SignalContext.getLocalizedEmojiList('en');
        } catch (error) {
          log.error('Failed to get fallback localized emoji list');
        }
      }

      if (!canceled && result !== undefined) {
        searchRef.current = createSearch(result);
      }
    }
    drop(run());

    return () => {
      canceled = true;
    };
  }, [locale]);

  return useCallback((...args) => {
    return searchRef.current?.(...args);
  }, []);
}
