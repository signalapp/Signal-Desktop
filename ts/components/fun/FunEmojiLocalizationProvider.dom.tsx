// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, {
  createContext,
  memo,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { LocaleEmojiListType } from '../../types/emoji.std.js';
import { createLogger } from '../../logging/log.std.js';
import * as Errors from '../../types/errors.std.js';
import { drop } from '../../util/drop.std.js';
import {
  getEmojiDefaultEnglishLocalizerIndex,
  getEmojiDefaultEnglishSearchIndex,
} from './data/emojis.std.js';
import {
  createFunEmojiLocalizerIndex,
  type FunEmojiLocalizerIndex,
} from './useFunEmojiLocalizer.dom.js';
import {
  createFunEmojiSearchIndex,
  type FunEmojiSearchIndex,
} from './useFunEmojiSearch.dom.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { isTestOrMockEnvironment } from '../../environment.std.js';

const log = createLogger('FunEmojiLocalizationProvider');

export type FunEmojiLocalizationContextType = Readonly<{
  emojiSearchIndex: FunEmojiSearchIndex;
  emojiLocalizerIndex: FunEmojiLocalizerIndex;
}>;

export const FunEmojiLocalizationContext =
  createContext<FunEmojiLocalizationContextType | null>(null);

export function useFunEmojiLocalization(): FunEmojiLocalizationContextType {
  const fun = useContext(FunEmojiLocalizationContext);
  strictAssert(
    fun != null,
    'Must be wrapped with <FunEmojiLocalizationProvider>'
  );
  return fun;
}

export type FunEmojiLocalizationProviderProps = Readonly<{
  i18n: LocalizerType;
  children: ReactNode;
}>;

export const FunEmojiLocalizationProvider = memo(
  function FunEmojiLocalizationProvider(
    props: FunEmojiLocalizationProviderProps
  ) {
    const localeEmojiList = useLocaleEmojiList(props.i18n);
    const emojiSearchIndex = useFunEmojiSearchIndex(localeEmojiList);
    const emojiLocalizerIndex = useFunEmojiLocalizerIndex(localeEmojiList);

    const context = useMemo((): FunEmojiLocalizationContextType => {
      return { emojiSearchIndex, emojiLocalizerIndex };
    }, [emojiSearchIndex, emojiLocalizerIndex]);

    return (
      <FunEmojiLocalizationContext.Provider value={context}>
        {props.children}
      </FunEmojiLocalizationContext.Provider>
    );
  }
);

export type FunEmptyEmojiLocalizationProviderProps = Readonly<{
  children: ReactNode;
}>;

export function FunDefaultEnglishEmojiLocalizationProvider(
  props: FunEmptyEmojiLocalizationProviderProps
): JSX.Element {
  const context = useMemo(() => {
    return {
      emojiSearchIndex: getEmojiDefaultEnglishSearchIndex(),
      emojiLocalizerIndex: getEmojiDefaultEnglishLocalizerIndex(),
    };
  }, []);
  return (
    <FunEmojiLocalizationContext.Provider value={context}>
      {props.children}
    </FunEmojiLocalizationContext.Provider>
  );
}

function useLocaleEmojiList(i18n: LocalizerType): LocaleEmojiListType | null {
  const locale = useMemo(() => i18n.getLocale(), [i18n]);

  const [localeEmojiList, setLocaleEmojiList] =
    useState<LocaleEmojiListType | null>(null);

  useEffect(() => {
    let canceled = false;
    async function run(): Promise<void> {
      if (isTestOrMockEnvironment()) {
        return;
      }
      try {
        const list = await window.SignalContext.getLocalizedEmojiList(locale);
        if (!canceled) {
          setLocaleEmojiList(list);
        }
      } catch (error) {
        log.error(
          `FunProvider: Failed to get localized emoji list for "${locale}"`,
          Errors.toLogFormat(error)
        );
      }
    }
    drop(run());
    return () => {
      canceled = true;
    };
  }, [locale]);

  return localeEmojiList;
}

function useFunEmojiSearchIndex(
  localeEmojiList: LocaleEmojiListType | null
): FunEmojiSearchIndex {
  const funEmojiSearchIndex = useMemo(() => {
    const defaultSearchIndex = getEmojiDefaultEnglishSearchIndex();
    return localeEmojiList != null
      ? createFunEmojiSearchIndex(localeEmojiList, defaultSearchIndex)
      : defaultSearchIndex;
  }, [localeEmojiList]);
  return funEmojiSearchIndex;
}

function useFunEmojiLocalizerIndex(
  localeEmojiList: LocaleEmojiListType | null
): FunEmojiLocalizerIndex {
  const funEmojiLocalizerIndex = useMemo(() => {
    const defaultSearchIndex = getEmojiDefaultEnglishLocalizerIndex();
    return localeEmojiList != null
      ? createFunEmojiLocalizerIndex(localeEmojiList, defaultSearchIndex)
      : defaultSearchIndex;
  }, [localeEmojiList]);
  return funEmojiLocalizerIndex;
}
