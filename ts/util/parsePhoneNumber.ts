import { instance, PhoneNumberFormat } from './libphonenumberInstance';

export function parsePhoneNumber(
  phoneNumber: string,
  options: {
    regionCode: string;
  }
): string {
  const { regionCode } = options;
  const parsedNumber = instance.parse(phoneNumber, regionCode);

  if (instance.isValidNumber(parsedNumber)) {
    return instance.format(parsedNumber, PhoneNumberFormat.E164);
  }

  return phoneNumber;
}
