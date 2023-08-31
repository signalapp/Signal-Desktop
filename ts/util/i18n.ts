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
      // eslint:disable: no-console
      // eslint-disable-next-line no-console
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
    }
    if (substitutions) {
      return message.replace(/\$.+?\$/, substitutions);
    }

    return message;
  }

  getMessage.getLocale = () => locale;

  return getMessage;
};

// eslint-disable-next-line import/no-mutable-exports
export let langNotSupportedMessageShown = false;

export const loadEmojiPanelI18n = async () => {
  if (!window) {
    return undefined;
  }

  const lang = (window.i18n as any).getLocale();
  if (lang !== 'en') {
    try {
      const langData = await import(`@emoji-mart/data/i18n/${lang}.json`);
      return langData;
    } catch (err) {
      if (!langNotSupportedMessageShown) {
        window?.log?.warn(
          'Language is not supported by emoji-mart package. See https://github.com/missive/emoji-mart/tree/main/packages/emoji-mart-data/i18n'
        );
        langNotSupportedMessageShown = true;
      }
    }
  }
  return undefined;
};

// RTL Support

export type HTMLDirection = 'ltr' | 'rtl';

export function isRtlBody(): boolean {
  const body = document.getElementsByTagName('body').item(0);

  return body?.classList.contains('rtl') || false;
}

export const useHTMLDirection = (): HTMLDirection => (isRtlBody() ? 'rtl' : 'ltr');
