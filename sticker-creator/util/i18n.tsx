// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocaleMessagesType } from '../../ts/types/I18N';
import type { LocalizerType, ReplacementValuesType } from '../../ts/types/Util';
import {
  classifyMessages,
  createCachedIntl,
  formatIcuMessage,
} from '../../ts/util/setupI18n';

const placeholder = () => 'NO LOCALE LOADED';
placeholder.getLocale = () => 'none';
placeholder.isLegacyFormat = () => {
  throw new Error("Can't call isLegacyFormat on placeholder");
};
placeholder.getIntl = () => {
  throw new Error("Can't call getIntl on placeholder");
};

const I18nContext = React.createContext<LocalizerType>(placeholder);

export type I18nProps = {
  children: React.ReactNode;
  locale: string;
  messages: LocaleMessagesType;
};

export function I18n({ messages, locale, children }: I18nProps): JSX.Element {
  const { icuMessages, legacyMessages } = React.useMemo(() => {
    return classifyMessages(messages);
  }, [messages]);
  const intl = React.useMemo(() => {
    return createCachedIntl(locale, icuMessages);
  }, [locale, icuMessages]);

  const callback = (key: string, substitutions?: ReplacementValuesType) => {
    if (Array.isArray(substitutions) && substitutions.length > 1) {
      throw new Error(
        'Array syntax is not supported with more than one placeholder'
      );
    }

    const messageformat = icuMessages[key];
    if (messageformat != null) {
      return formatIcuMessage(intl, key, substitutions);
    }

    const message = legacyMessages[key];
    if (message == null) {
      window.SignalContext.log.warn(
        `getMessage: No string found for key ${key}`
      );
      return '';
    }
    if (!substitutions) {
      return message;
    }
    if (Array.isArray(substitutions)) {
      return substitutions.reduce(
        (result, substitution) =>
          result.toString().replace(/\$.+?\$/, substitution.toString()),
        message
      ) as string;
    }

    const FIND_REPLACEMENTS = /\$([^$]+)\$/g;

    let match = FIND_REPLACEMENTS.exec(message);
    let builder = '';
    let lastTextIndex = 0;

    while (match) {
      if (lastTextIndex < match.index) {
        builder += message.slice(lastTextIndex, match.index);
      }

      const placeholderName = match[1];
      const value = substitutions[placeholderName];
      if (!value) {
        // eslint-disable-next-line no-console
        console.error(
          `i18n: Value not provided for placeholder ${placeholderName} in key '${key}'`
        );
      }
      builder += value || '';

      lastTextIndex = FIND_REPLACEMENTS.lastIndex;
      match = FIND_REPLACEMENTS.exec(message);
    }

    if (lastTextIndex < message.length) {
      builder += message.slice(lastTextIndex);
    }

    return builder;
  };
  callback.getLocale = () => locale;
  callback.isLegacyFormat = (key: string) => {
    return legacyMessages[key] != null;
  };
  callback.getIntl = () => intl;

  const getMessage = React.useCallback<LocalizerType>(callback, [
    icuMessages,
    legacyMessages,
    intl,
  ]);

  return (
    <I18nContext.Provider value={getMessage}>{children}</I18nContext.Provider>
  );
}

export const useI18n = (): LocalizerType => React.useContext(I18nContext);
