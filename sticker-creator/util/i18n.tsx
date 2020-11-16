// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

export type I18nFn = (
  key: string,
  substitutions?: Array<string | number> | ReplacementValuesType
) => string;

export type ReplacementValuesType = {
  [key: string]: string | number;
};

const I18nContext = React.createContext<I18nFn>(() => 'NO LOCALE LOADED');

export type I18nProps = {
  children: React.ReactNode;
  messages: { [key: string]: { message: string } };
};

export const I18n = ({ messages, children }: I18nProps): JSX.Element => {
  const getMessage = React.useCallback<I18nFn>(
    (key, substitutions) => {
      if (Array.isArray(substitutions) && substitutions.length > 1) {
        throw new Error(
          'Array syntax is not supported with more than one placeholder'
        );
      }

      const { message } = messages[key];
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
    },
    [messages]
  );

  return (
    <I18nContext.Provider value={getMessage}>{children}</I18nContext.Provider>
  );
};

export const useI18n = (): I18nFn => React.useContext(I18nContext);
