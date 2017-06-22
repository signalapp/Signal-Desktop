const path = require('path');
const fs = require('fs');
const app = require('electron').app;

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

// Load locale - if we can't load messages for the current locale, we
// default to 'en'
//
// possible locales:
// https://github.com/electron/electron/blob/master/docs/api/locales.md
let localeName = normalizeLocaleName(app.getLocale());
let messages;

try {
  messages = getLocaleMessages(localeName);
} catch (e) {
  console.log('Problem loading messages for locale ', localeName, e.stack);
  console.log('Falling back to en locale');

  localeName = 'en';
  messages = getLocaleMessages(localeName);
}

module.exports = {
  name: localeName,
  messages
}
