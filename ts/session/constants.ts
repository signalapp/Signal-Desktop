import { DAYS, HOURS, MINUTES } from './utils/Number';
// tslint:disable: binary-expression-operand-order

/**
 * FIXME The -1 hours is a hack to make the PN not trigger a Notification for those control message.
 * Apple devices must show a Notification if a PN is received, and for those
 * control message, there is nothing to display (yet).
 */
export const TTL_DEFAULT = {
  PAIRING_REQUEST: 2 * MINUTES,
  DEVICE_UNPAIRING: 4 * DAYS - 1 * HOURS,
  SESSION_REQUEST: 4 * DAYS - 1 * HOURS,
  SESSION_ESTABLISHED: 2 * DAYS - 1 * HOURS,
  END_SESSION_MESSAGE: 4 * DAYS - 1 * HOURS,
  TYPING_MESSAGE: 1 * MINUTES,
  ONLINE_BROADCAST: 1 * MINUTES,
  REGULAR_MESSAGE: 2 * DAYS,
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

  COLORS: {
    // COMMON
    WHITE: '#FFFFFF',
    WHITE_PALE: '#AFAFAF',
    LIGHT_GREY: '#A0A0A0',
    DARK_GREY: '#353535',
    BLACK: '#000000',
    GREEN: '#00F782',
    GREEN_ALT_1: '#00F480',
    GREEN_ALT_2: '#00FD73',
    GREEN_ALT_3: '#00F782',
    BACKGROUND: '#121212',

    // SHADES
    SHADE_1: '#0C0C0C',
    SHADE_1_ALT: '#0F1011',
    SHADE_2: '#161616',
    SHADE_3: '#191818',
    SHADE_4: '#1B1B1B',
    SHADE_5: '#222325',
    SHADE_6: '#232323',
    SHADE_6_ALT: '#2C2C2C',
    SHADE_7: '#2E2E2E',
    SHADE_8: '#2F2F2F',
    SHADE_9: '#313131',
    SHADE_10: '#3E3E3E',
    SHADE_11: '#3F3F3F',
    SHADE_12: '#3F4146',
    SHADE_13: '#474646',
    SHADE_14: '#535865',
    SHADE_15: '#5B6C72',
    SHADE_16: '#979797',
    SHADE_17: '#A0A0A0',
    SHADE_18: '#141414',

    // SEMANTIC COLORS
    INFO: '#3F3F3F',
    SUCCESS: '#35D388',
    ERROR: '#EDD422',
    WARNING: '#A0A0A0',
    WARNING_ALT: '#FF9D00',
    DANGER: '#FF453A',
    DANGER_ALT: '#FF4538',
    PRIMARY: '#474646',
    SECONDARY: '#232323',
  },
};
