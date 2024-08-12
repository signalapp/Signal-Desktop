import { CONSTANTS, ConstantsType } from 'libsession_util_nodejs';

// NOTE CONSTANTS is an immediately invoked function that returns the libsession constants object
const {
  CONTACT_MAX_NAME_LENGTH,
  BASE_GROUP_MAX_NAME_LENGTH,
  GROUP_INFO_MAX_NAME_LENGTH,
  COMMUNITY_FULL_URL_MAX_LENGTH,
} = CONSTANTS;

const LIBSESSION_CONSTANTS: ConstantsType = {
  CONTACT_MAX_NAME_LENGTH,
  BASE_GROUP_MAX_NAME_LENGTH,
  GROUP_INFO_MAX_NAME_LENGTH,
  COMMUNITY_FULL_URL_MAX_LENGTH,
};

export default LIBSESSION_CONSTANTS;
