import { NumberUtils } from './utils';

// Default TTL
export const TTL_DEFAULT = {
  PAIRING_REQUEST: NumberUtils.timeAsMs(2, 'minutes'),
  DEVICE_UNPAIRING: NumberUtils.timeAsMs(4, 'days'),
  SESSION_REQUEST: NumberUtils.timeAsMs(4, 'days'),
  SESSION_ESTABLISHED: NumberUtils.timeAsMs(2, 'days'),
  END_SESSION_MESSAGE: NumberUtils.timeAsMs(4, 'days'),
  TYPING_MESSAGE: NumberUtils.timeAsMs(1, 'minute'),
  ONLINE_BROADCAST: NumberUtils.timeAsMs(1, 'minute'),
  REGULAR_MESSAGE: NumberUtils.timeAsMs(2, 'days'),
};

// User Interface
export const CONVERSATION = {
  MAX_MESSAGE_BODY_LENGTH: 2000,
  DEFAULT_MEDIA_FETCH_COUNT: 50,
  DEFAULT_DOCUMENTS_FETCH_COUNT: 150,
  DEFAULT_MESSAGE_FETCH_COUNT: 30,
  MAX_MESSAGE_FETCH_COUNT: 500,
  MESSAGE_FETCH_INTERVAL: 1,
  // Maximum voice message duraiton of 5 minutes
  // which equates to 1.97 MB
  MAX_VOICE_MESSAGE_DURATION: 300,
  // Max attachment size: 10 MB
  MAX_ATTACHMENT_FILESIZE: 10000000,
};

export const UI = {
  // Pixels (scroll) from the top of the top of message container
  // at which more messages should be loaded
  MESSAGE_CONTAINER_BUFFER_OFFSET_PX: 30,
};
