import { toLogFormat } from '../../js/modules/types/errors';
import { instance, PhoneNumberFormat } from './libphonenumberInstance';

export function formatPhoneNumber(
  number: string,
  options: {
    ourRegionCode: string;
  }
) {
  try {
    const { ourRegionCode } = options;
    const parsedNumber = instance.parse(number);
    const regionCode = instance.getRegionCodeForNumber(parsedNumber);

    if (ourRegionCode && regionCode === ourRegionCode) {
      return instance.format(parsedNumber, PhoneNumberFormat.NATIONAL);
    }

    return instance.format(parsedNumber, PhoneNumberFormat.INTERNATIONAL);
  } catch (error) {
    console.log(
      'formatPhoneNumber - had problems formatting number:',
      toLogFormat(error)
    );
    return number;
  }
}
