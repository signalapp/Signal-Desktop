// this file is a weird one as it is used by both sides of electron at the same time

import { LocaleMessagesType } from '../node/locale';

export const setupi18n = (locale: string, messages: LocaleMessagesType) => {
  if (!locale) {
    throw new Error('i18n: locale parameter is required');
  }
  if (!messages) {
    throw new Error('i18n: messages parameter is required');
  }

  function getMessage(key: string, substitutions: Array<string>) {
    const message = messages[key];
    if (!message) {
      // tslint:disable-next-line: no-console
      (window.log.error || console.log)(
        `i18n: Attempted to get translation for nonexistent key '${key}'`
      );
      return '';
    }

    if (Array.isArray(substitutions)) {
      const replacedNameDollarSign = message.replaceAll('$', 'ￗ');

      const substituted = substitutions.reduce(
        (result, substitution) => result.replace(/ￗ.+?ￗ/, substitution),
        replacedNameDollarSign
      );

      return substituted.replaceAll('ￗ', '$');
    } else if (substitutions) {
      return message.replace(/\$.+?\$/, substitutions);
    }

    return message;
  }

  getMessage.getLocale = () => locale;

  return getMessage;
};
