export type LocaleMessagesType = {
  [key: string]: {
    message: string;
    description?: string;
  };
};

export type LocaleType = {
  i18n: (key: string, placeholders: Array<string>) => string;
  messages: LocaleMessagesType;
};
