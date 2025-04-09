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
import type { LocaleEmojiListType } from '../../types/emoji';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import { drop } from '../../util/drop';
import {
  getEmojiDefaultEnglishLocalizerIndex,
  getEmojiDefaultEnglishSearchIndex,
} from './data/emojis';
import {
  createFunEmojiLocalizerIndex,
  type FunEmojiLocalizerIndex,
} from './useFunEmojiLocalizer';
import {
  createFunEmojiSearchIndex,
  type FunEmojiSearchIndex,
} from './useFunEmojiSearch';
import type { LocalizerType } from '../../types/I18N';
import { strictAssert } from '../../util/assert';

export type FunEmojiLocalizationContextType = Readonly<{
  emojiSearchIndex: FunEmojiSearchIndex;
  emojiLocalizerIndex: FunEmojiLocalizerIndex;
}>;

export const FunEmojiLocalizationContext =
  createContext<FunEmojiLocalizationContextType | null>(null);

export function useFunEmojiLocalization(): FunEmojiLocalizationContextType {
  const fun = useContext(FunEmojiLocalizationContext);
  strictAssert(fun != null, 'Must be wrapped with <FunProvider>');
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

function useLocaleEmojiList(i18n: LocalizerType): LocaleEmojiListType | null {
  const locale = useMemo(() => i18n.getLocale(), [i18n]);

  const [localeEmojiList, setLocaleEmojiList] =
    useState<LocaleEmojiListType | null>(null);

  useEffect(() => {
    let canceled = false;
    async function run(): Promise<void> {
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
    return localeEmojiList != null
      ? createFunEmojiSearchIndex(localeEmojiList)
      : getEmojiDefaultEnglishSearchIndex();
  }, [localeEmojiList]);
  return funEmojiSearchIndex;
}

function useFunEmojiLocalizerIndex(
  localeEmojiList: LocaleEmojiListType | null
): FunEmojiLocalizerIndex {
  const funEmojiLocalizerIndex = useMemo(() => {
    return localeEmojiList != null
      ? createFunEmojiLocalizerIndex(localeEmojiList)
      : getEmojiDefaultEnglishLocalizerIndex();
  }, [localeEmojiList]);
  return funEmojiLocalizerIndex;
}
