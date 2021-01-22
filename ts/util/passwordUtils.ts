import * as crypto from 'crypto';
import { LocalizerType } from '../types/Util';

const ERRORS = {
  TYPE: 'Password must be a string',
  LENGTH: 'Password must be between 6 and 64 characters long',
  CHARACTER: 'Password must only contain letters, numbers and symbols',
};

const sha512 = (text: string) => {
  const hash = crypto.createHash('sha512');
  hash.update(text.trim());
  return hash.digest('hex');
};

export const generateHash = (phrase: string) => phrase && sha512(phrase.trim());
export const matchesHash = (phrase: string | null, hash: string) =>
  phrase && sha512(phrase.trim()) === hash.trim();

export const validatePassword = (phrase: string, i18n?: LocalizerType) => {
  if (typeof phrase !== 'string') {
    return i18n ? i18n('passwordTypeError') : ERRORS.TYPE;
  }

  const trimmed = phrase.trim();
  if (trimmed.length === 0) {
    return i18n ? i18n('noGivenPassword') : ERRORS.LENGTH;
  }

  if (
    trimmed.length < 6 ||
    trimmed.length > window.CONSTANTS.MAX_PASSWORD_LENGTH
  ) {
    return i18n ? i18n('passwordLengthError') : ERRORS.LENGTH;
  }

  // Restrict characters to letters, numbers and symbols
  const characterRegex = /^[a-zA-Z0-9-!()._`~@#$%^&*+=[\]{}|<>,;: ]+$/;
  if (!characterRegex.test(trimmed)) {
    return i18n ? i18n('passwordCharacterError') : ERRORS.CHARACTER;
  }

  return null;
};
