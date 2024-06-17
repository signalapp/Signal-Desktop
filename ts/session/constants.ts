const seconds = 1000;
const minutes = seconds * 60;
const hours = minutes * 60;
const days = hours * 24;

/** in milliseconds */
export const DURATION = {
  /** 1000ms */
  SECONDS: seconds,
  /** 60 * 1000 = 60,000 ms */
  MINUTES: minutes,
  /** 60 * 60 * 1000 = 3,600,000 ms */
  HOURS: hours,
  /** 24 * 60 * 60 * 1000 = 86,400,000 ms */
  DAYS: days,
  /** 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms */
  WEEKS: days * 7,
};

export const FILESIZE = {
  /** 1KB */
  KB: 1024,
  /** 1MB */
  MB: 1024 * 1024,
  /** 1GB */
  GB: 1024 * 1024 * 1024,
};

export const TTL_DEFAULT = {
  /** 20 seconds */
  TYPING_MESSAGE: 20 * DURATION.SECONDS,
  /** 5 minutes */
  CALL_MESSAGE: 5 * 60 * DURATION.SECONDS,
  /** 14 days */
  CONTENT_MESSAGE: 14 * DURATION.DAYS,
  /** 30 days */
  CONFIG_MESSAGE: 30 * DURATION.DAYS,
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
  MAX_CONVO_UNREAD_COUNT: 999,
  MAX_GLOBAL_UNREAD_COUNT: 99, // the global one does not look good with 4 digits (999+) so we have a smaller one for it
} as const;

/**
 * The file server and onion request max upload size is 10MB precisely.
 * 10MB is still ok, but one byte more is not.
 */
export const MAX_ATTACHMENT_FILESIZE_BYTES = 10 * 1000 * 1000;

export const VALIDATION = {
  MAX_GROUP_NAME_LENGTH: 30,
  CLOSED_GROUP_SIZE_LIMIT: 100,
};

export const DEFAULT_RECENT_REACTS = ['😂', '🥰', '😢', '😡', '😮', '😈'];
export const REACT_LIMIT = 6;

export const MAX_USERNAME_BYTES = 64;

export const FEATURE_RELEASE_TIMESTAMPS = {
  DISAPPEARING_MESSAGES_V2: 1710284400000, // 13/03/2024 10:00 Melbourne time
  USER_CONFIG: 1690761600000, // Monday July 31st at 10am Melbourne time
};
