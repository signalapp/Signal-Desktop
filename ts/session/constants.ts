// tslint:disable: binary-expression-operand-order

const seconds = 1000;
const minutes = seconds * 60;
const hours = minutes * 60;
const days = hours * 24;

export const DURATION = {
  SECONDS: seconds, // in ms
  MINUTES: minutes, // in ms
  HOURS: hours, // in ms
  DAYS: days, // in ms
};

export const TTL_DEFAULT = {
  TYPING_MESSAGE: 20 * DURATION.SECONDS,
  CALL_MESSAGE: 5 * 60 * DURATION.SECONDS,
  TTL_MAX: 14 * DURATION.DAYS,
};

export const SWARM_POLLING_TIMEOUT = {
  ACTIVE: DURATION.SECONDS * 5,
  MEDIUM_ACTIVE: DURATION.SECONDS * 60,
  INACTIVE: DURATION.SECONDS * 120,
};

export const PROTOCOLS = {
  // tslint:disable-next-line: no-http-string
  HTTP: 'http:',
  HTTPS: 'https:',
};

// User Interface
export const CONVERSATION = {
  DEFAULT_MEDIA_FETCH_COUNT: 50,
  DEFAULT_DOCUMENTS_FETCH_COUNT: 100,
  DEFAULT_MESSAGE_FETCH_COUNT: 30,
  MAX_MESSAGE_FETCH_COUNT: 1000,
  // Maximum voice message duraton of 5 minutes
  // which equates to 1.97 MB
  MAX_VOICE_MESSAGE_DURATION: 300,
};
// Max attachment size: 6 MB

export const MAX_ATTACHMENT_FILESIZE_BYTES = 6 * 1000 * 1000; // 6MB

export const VALIDATION = {
  MAX_GROUP_NAME_LENGTH: 64,
  CLOSED_GROUP_SIZE_LIMIT: 100,
};

export const UI = {
  COLORS: {
    // COMMON
    GREEN: '#00F782',
  },
};
