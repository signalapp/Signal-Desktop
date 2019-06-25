import { instance, PhoneNumberFormat } from '../util/libphonenumberInstance';
import memoizee from 'memoizee';

function _format(
  phoneNumber: string,
  options: {
    ourRegionCode: string;
  }
) {
  try {
    const { ourRegionCode } = options;
    const parsedNumber = instance.parse(phoneNumber);
    const regionCode = instance.getRegionCodeForNumber(parsedNumber);

    if (ourRegionCode && regionCode === ourRegionCode) {
      return instance.format(parsedNumber, PhoneNumberFormat.NATIONAL);
    }

    return instance.format(parsedNumber, PhoneNumberFormat.INTERNATIONAL);
  } catch (error) {
    return phoneNumber;
  }
}

export const format = memoizee(_format, {
  primitive: true,
  // Convert the arguments to a unique string, required for primitive mode.
  normalizer: (...args) => JSON.stringify(args),
});

export function parse(
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

export function normalize(
  phoneNumber: string,
  options: { regionCode: string }
): string | undefined {
  const { regionCode } = options;
  try {
    const parsedNumber = instance.parse(phoneNumber, regionCode);

    if (instance.isValidNumber(parsedNumber)) {
      return instance.format(parsedNumber, PhoneNumberFormat.E164);
    }

    return;
  } catch (error) {
    return;
  }
}
