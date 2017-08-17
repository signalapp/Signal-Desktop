const path = require('path');
const fs = require('fs');
const app = require('electron').app;
const _ = require('lodash');

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
    'messages.json'
  );

  return JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
}

function load() {
  var english = getLocaleMessages('en');

  // Load locale - if we can't load messages for the current locale, we
  // default to 'en'
  //
  // possible locales:
  // https://github.com/electron/electron/blob/master/docs/api/locales.md
  let localeName = normalizeLocaleName(app.getLocale());
  let messages;

  try {
    messages = getLocaleMessages(localeName);

    // We start with english, then overwrite that with anything present in locale
    messages = _.merge(english, messages);
  } catch (e) {
    console.log('Problem loading messages for locale ', localeName, e.stack);
    console.log('Falling back to en locale');

    localeName = 'en';
    messages = english;
  }

  return {
    name: localeName,
    messages
  };
}

module.exports = {
  load: load
};
