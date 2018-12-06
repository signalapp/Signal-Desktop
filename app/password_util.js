const { sha512 } = require('js-sha512');

const generateHash = (phrase) => phrase && sha512(phrase.trim());
const matchesHash = (phrase, hash) => phrase && sha512(phrase.trim()) === hash.trim();

const validatePassword = (phrase) => {
  if (typeof phrase !== 'string') {
    return 'Password must be a string'
  }

  if (phrase && phrase.trim().length < 6) {
    return 'Password must be atleast 6 characters long';
  }

  // An empty password is still valid :P
  return null;
}

module.exports = {
  generateHash,
  matchesHash,
  validatePassword,
};