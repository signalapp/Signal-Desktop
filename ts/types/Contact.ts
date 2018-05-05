// @ts-ignore
import Attachments from '../../app/attachments';
import { formatPhoneNumber } from '../util/formatPhoneNumber';

export interface Contact {
  name: Name;
  number?: Array<Phone>;
  email?: Array<Email>;
  address?: Array<PostalAddress>;
  avatar?: Avatar;
  organization?: string;
}

interface Name {
  givenName?: string;
  familyName?: string;
  prefix?: string;
  suffix?: string;
  middleName?: string;
  displayName: string;
}

export enum ContactType {
  HOME = 1,
  MOBILE = 2,
  WORK = 3,
  CUSTOM = 4,
}

export enum AddressType {
  HOME = 1,
  WORK = 2,
  CUSTOM = 3,
}

export interface Phone {
  value: string;
  type: ContactType;
  label?: string;
}

export interface Email {
  value: string;
  type: ContactType;
  label?: string;
}

export interface PostalAddress {
  type: AddressType;
  label?: string;
  street?: string;
  pobox?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
}

interface Avatar {
  avatar: Attachment;
  isProfile: boolean;
}

interface Attachment {
  path: string;
}

export function contactSelector(
  contact: Contact,
  options: {
    regionCode: string;
    getAbsoluteAttachmentPath: (path: string) => string;
  }
) {
  const { regionCode, getAbsoluteAttachmentPath } = options;

  let { avatar } = contact;
  if (avatar && avatar.avatar && avatar.avatar.path) {
    avatar = {
      ...avatar,
      avatar: {
        ...avatar.avatar,
        path: getAbsoluteAttachmentPath(avatar.avatar.path),
      },
    };
  }
  return Object.assign({}, contact, {
    avatar,
    number:
      contact.number &&
      contact.number.map(item => ({
        ...item,
        value: formatPhoneNumber(item.value, {
          ourRegionCode: regionCode,
        }),
      })),
  });
}
