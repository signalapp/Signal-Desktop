const seconds = 1000;
const minutes = seconds * 60;
const hours = minutes * 60;
const days = hours * 24;

/** in millisecond */
export const DURATION = {
  /** 1000ms */
  SECONDS: seconds,
  /** 60 * 1000 = 60,000 ms */
  MINUTES: minutes,
  /** 60 * 60 * 1000 = 3,600,000 ms */
  HOURS: hours,
  /** 24 * 60 * 60 * 1000 = 86,400,000 ms */
  DAYS: days,
};

export const TTL_DEFAULT = {
  /** 20 seconds */
  TYPING_MESSAGE: 20 * DURATION.SECONDS,
  /** 5 minutes */
  CALL_MESSAGE: 5 * 60 * DURATION.SECONDS,
  /** 14 days */
  TTL_MAX: 14 * DURATION.DAYS,
  /** 30 days */
  TTL_CONFIG: 30 * DURATION.DAYS,
};

export const SWARM_POLLING_TIMEOUT = {
  /** 5 seconds */
  ACTIVE: DURATION.SECONDS * 5,
  /** 1 minute */
  MEDIUM_ACTIVE: DURATION.SECONDS * 60,
  /** 2 minutes */
  INACTIVE: DURATION.SECONDS * 120,
};

export const PROTOCOLS = {
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
  MAX_UNREAD_COUNT: 999,
};

/**
 * The file server and onion request max upload size is 10MB precisely.
 * 10MB is still ok, but one byte more is not.
 */
export const MAX_ATTACHMENT_FILESIZE_BYTES = 10 * 1000 * 1000;

export const VALIDATION = {
  MAX_GROUP_NAME_LENGTH: 30,
  CLOSED_GROUP_SIZE_LIMIT: 100,
};

export const UI = {
  COLORS: {
    // COMMON
    GREEN: '#00F782',
  },
};

export const DEFAULT_RECENT_REACTS = ['😂', '🥰', '😢', '😡', '😮', '😈'];
export const REACT_LIMIT = 6;

export const MAX_USERNAME_BYTES = 64;

export const FEATURE_RELEASE_TIMESTAMPS = {
  // TODO update to agreed value between platforms for `disappearing_messages`
  DISAPPEARING_MESSAGES_V2: 1706778000000, // unix 01/02/2024 09:00
  // NOTE for testing purposes only
  // DISAPPEARING_MESSAGES_V2: 1677488400000, // unix 27/02/2023 09:00

  USER_CONFIG: 1690761600000, // Monday July 31st at 10am Melbourne time
  // USER_CONFIG: 1677488400000, // testing: unix 27/02/2023 09:00
};
