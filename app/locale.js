const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const _ = require('lodash');

const logging = require('./logging');

function normalizeLocaleName(locale) {
  if (/^en-/.test(locale)) {
    return 'en';
  }

  return locale;
}

function getLocaleMessages(locale) {
  const onDiskLocale = locale.replace('-', '_');

  const targetFile = path.join(
    __dirname,
    '..',
    '_locales',
    onDiskLocale,
    'messages.json',
  );

  return JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
}

function load() {
  const logger = logging.getLogger();
  const english = getLocaleMessages('en');
  let appLocale = app.getLocale();

  if (process.env.NODE_ENV === 'test') {
    appLocale = 'en';
  }

  // Load locale - if we can't load messages for the current locale, we
  // default to 'en'
  //
  // possible locales:
  // https://github.com/electron/electron/blob/master/docs/api/locales.md
  let localeName = normalizeLocaleName(appLocale);
  let messages;

  try {
    messages = getLocaleMessages(localeName);

    // We start with english, then overwrite that with anything present in locale
    messages = _.merge(english, messages);
  } catch (e) {
    logger.error(`Problem loading messages for locale ${localeName} ${e.stack}`);
    logger.error('Falling back to en locale');

    localeName = 'en';
    messages = english;
  }

  return {
    name: localeName,
    messages,
  };
}

module.exports = {
  load,
};
