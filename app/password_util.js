const { sha512 } = require('js-sha512');

const generateHash = (phrase) => phrase && sha512(phrase.trim());
const matchesHash = (phrase, hash) => phrase && sha512(phrase.trim()) === hash.trim();

const validatePassword = (phrase, i18n) => {
  if (typeof phrase !== 'string') {
    return i18n ? i18n('passwordTypeError') : 'Password must be a string'
  }

  if (phrase && phrase.trim().length < 6) {
    return i18n ? i18n('passwordLengthError') : 'Password must be atleast 6 characters long';
  }

  // An empty password is still valid :P
  return null;
}

module.exports = {
  generateHash,
  matchesHash,
  validatePassword,
};