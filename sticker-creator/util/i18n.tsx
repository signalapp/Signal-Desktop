import * as React from 'react';

export type I18nFn = (
  key: string,
  substitutions?: Array<string | number>
) => string;

const I18nContext = React.createContext<I18nFn>(() => 'NO LOCALE LOADED');

export type I18nProps = {
  children: React.ReactNode;
  messages: { [key: string]: { message: string } };
};

export const I18n = ({ messages, children }: I18nProps) => {
  const getMessage = React.useCallback<I18nFn>(
    (key, substitutions = []) =>
      substitutions.reduce<string>(
        (res, sub) => res.replace(/\$.+?\$/, sub),
        messages[key].message
      ),
    [messages]
  );

  return (
    <I18nContext.Provider value={getMessage}>{children}</I18nContext.Provider>
  );
};

export const useI18n = () => React.useContext(I18nContext);
