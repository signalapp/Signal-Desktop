export type LocaleMessagesType = {
  [key: string]: {
    message: string;
    description?: string;
  };
};

export type ReplacementValuesType<T> = {
  [key: string]: T;
};

export type LocaleType = {
  i18n: (
    key: string,
    placeholders: Array<string> | ReplacementValuesType<string>
  ) => string;
  messages: LocaleMessagesType;
};
