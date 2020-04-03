import libphonenumber from 'google-libphonenumber';

const instance = libphonenumber.PhoneNumberUtil.getInstance();
const PhoneNumberFormat = libphonenumber.PhoneNumberFormat;

export { instance, PhoneNumberFormat };
