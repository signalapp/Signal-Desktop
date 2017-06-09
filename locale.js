const path = require('path');
const fs = require('fs');

function normalizeLocaleName(locale) {
  if (/^en-/.test(locale)) {
    return 'en';
  }

  return locale;
}

function getLocaleMessages(locale) {
  const onDiskLocale = locale.replace('-', '_');
  const targetFile = path.join(__dirname, '_locales', onDiskLocale, 'messages.json');

  return JSON.parse(fs.readFileSync(targetFile, 'utf-8'))
}

module.exports = {
  normalizeLocaleName,
  getLocaleMessages
}
