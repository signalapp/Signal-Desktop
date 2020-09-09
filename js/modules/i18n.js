/* eslint-env node, browser */

// eslint-disable-next-line no-console
const log = typeof window !== 'undefined' ? window.log : console;

exports.setup = (locale, messages) => {
  if (!locale) {
    throw new Error('i18n: locale parameter is required');
  }
  if (!messages) {
    throw new Error('i18n: messages parameter is required');
  }

  function getMessage(key, substitutions) {
    const entry = messages[key];
    if (!entry) {
      log.error(
        `i18n: Attempted to get translation for nonexistent key '${key}'`
      );
      return '';
    }
    if (Array.isArray(substitutions) && substitutions.length > 1) {
      throw new Error(
        'Array syntax is not supported with more than one placeholder'
      );
    }
    if (
      typeof substitutions === 'string' ||
      typeof substitutions === 'number'
    ) {
      throw new Error('You must provide either a map or an array');
    }

    const { message } = entry;
    if (!substitutions) {
      return message;
    }
    if (Array.isArray(substitutions)) {
      return substitutions.reduce(
        (result, substitution) => result.replace(/\$.+?\$/, substitution),
        message
      );
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
        log.error(
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
  }

  getMessage.getLocale = () => locale;

  return getMessage;
};
