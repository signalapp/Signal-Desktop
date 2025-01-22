// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import { SignalService as Proto } from '../protobuf';
import type { ReadonlyMessageAttributesType } from '../model-types.d';

import { isNotNil } from '../util/isNotNil';
import {
  format as formatPhoneNumber,
  normalize as normalizePhoneNumber,
} from './PhoneNumber';
import type {
  AttachmentType,
  AttachmentWithHydratedData,
  LocalAttachmentV2Type,
  UploadedAttachmentType,
} from './Attachment';
import { toLogFormat } from './errors';
import type { LoggerType } from './Logging';
import type { ServiceIdString } from './ServiceId';
import type { migrateDataToFileSystem } from '../util/attachments/migrateDataToFilesystem';
import { getLocalAttachmentUrl } from '../util/getLocalAttachmentUrl';

type GenericEmbeddedContactType<AvatarType> = {
  name?: Name;
  number?: ReadonlyArray<Phone>;
  email?: ReadonlyArray<Email>;
  address?: ReadonlyArray<PostalAddress>;
  avatar?: AvatarType;
  organization?: string;

  // Populated by selector
  firstNumber?: string;
  serviceId?: ServiceIdString;
};

export type EmbeddedContactType = GenericEmbeddedContactType<Avatar>;
export type EmbeddedContactWithHydratedAvatar =
  GenericEmbeddedContactType<AvatarWithHydratedData>;
export type EmbeddedContactWithUploadedAvatar =
  GenericEmbeddedContactType<UploadedAvatar>;

type Name = {
  givenName?: string;
  familyName?: string;
  prefix?: string;
  suffix?: string;
  middleName?: string;
  nickname?: string;
};

export enum ContactFormType {
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

export type Phone = {
  value: string;
  type: ContactFormType;
  label?: string;
};

export type Email = {
  value: string;
  type: ContactFormType;
  label?: string;
};

export type PostalAddress = {
  type: AddressType;
  label?: string;
  street?: string;
  pobox?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  postcode?: string;
  country?: string;
};

type GenericAvatar<Attachment> = {
  avatar: Attachment;
  isProfile: boolean;
};

export type Avatar = GenericAvatar<AttachmentType>;
export type AvatarWithHydratedData = GenericAvatar<AttachmentWithHydratedData>;
export type UploadedAvatar = GenericAvatar<UploadedAttachmentType>;

const DEFAULT_PHONE_TYPE = Proto.DataMessage.Contact.Phone.Type.HOME;
const DEFAULT_EMAIL_TYPE = Proto.DataMessage.Contact.Email.Type.HOME;
const DEFAULT_ADDRESS_TYPE = Proto.DataMessage.Contact.PostalAddress.Type.HOME;

export function numberToPhoneType(
  type: number
): Proto.DataMessage.Contact.Phone.Type {
  if (type === Proto.DataMessage.Contact.Phone.Type.MOBILE) {
    return type;
  }
  if (type === Proto.DataMessage.Contact.Phone.Type.WORK) {
    return type;
  }
  if (type === Proto.DataMessage.Contact.Phone.Type.CUSTOM) {
    return type;
  }

  return DEFAULT_PHONE_TYPE;
}

export function numberToEmailType(
  type: number
): Proto.DataMessage.Contact.Email.Type {
  if (type === Proto.DataMessage.Contact.Email.Type.MOBILE) {
    return type;
  }
  if (type === Proto.DataMessage.Contact.Email.Type.WORK) {
    return type;
  }
  if (type === Proto.DataMessage.Contact.Email.Type.CUSTOM) {
    return type;
  }

  return DEFAULT_EMAIL_TYPE;
}

export function numberToAddressType(
  type: number
): Proto.DataMessage.Contact.PostalAddress.Type {
  if (type === Proto.DataMessage.Contact.PostalAddress.Type.WORK) {
    return type;
  }
  if (type === Proto.DataMessage.Contact.PostalAddress.Type.CUSTOM) {
    return type;
  }

  return DEFAULT_ADDRESS_TYPE;
}

export function embeddedContactSelector(
  contact: ReadonlyDeep<EmbeddedContactType>,
  options: {
    regionCode?: string;
    firstNumber?: string;
    serviceId?: ServiceIdString;
  }
): ReadonlyDeep<EmbeddedContactType> {
  const { firstNumber, serviceId, regionCode } = options;

  let { avatar } = contact;
  if (avatar && avatar.avatar) {
    if (avatar.avatar.error) {
      avatar = undefined;
    } else {
      avatar = {
        ...avatar,
        avatar: {
          ...avatar.avatar,
          path: avatar.avatar.path
            ? getLocalAttachmentUrl(avatar.avatar)
            : undefined,
        },
      };
    }
  }

  return {
    ...contact,
    firstNumber,
    serviceId,
    avatar,
    number:
      contact.number &&
      contact.number.map(item => ({
        ...item,
        value: formatPhoneNumber(item.value, {
          ourRegionCode: regionCode,
        }),
      })),
  };
}

export function getDisplayName({
  name,
  organization,
}: ReadonlyDeep<EmbeddedContactType>): string | undefined {
  // See https://github.com/signalapp/Signal-iOS-Private/blob/210a46037f12cdc6ad97ac6dceb64fbc43469f67/SignalServiceKit/Messages/Interactions/ContactShare/OWSContactName.swift#L87-L104
  if (name?.nickname) {
    return name.nickname;
  }
  if (name?.givenName && name?.familyName) {
    return `${name.givenName} ${name.familyName}`;
  }
  if (organization) {
    return organization;
  }
  return undefined;
}

export function getName(
  contact: ReadonlyDeep<EmbeddedContactType>
): string | undefined {
  const { name } = contact;
  const givenName = (name && name.givenName) || undefined;
  const familyName = (name && name.familyName) || undefined;

  return getDisplayName(contact) || givenName || familyName;
}

export function parseAndWriteAvatar(
  upgradeAttachment: typeof migrateDataToFileSystem
) {
  return async (
    contact: EmbeddedContactType,
    context: {
      getRegionCode: () => string | undefined;
      logger: LoggerType;
      writeNewAttachmentData: (
        data: Uint8Array
      ) => Promise<LocalAttachmentV2Type>;
    },
    message: ReadonlyMessageAttributesType
  ): Promise<EmbeddedContactType> => {
    const { getRegionCode, logger } = context;
    const { avatar } = contact;

    const contactWithUpdatedAvatar =
      avatar && avatar.avatar
        ? {
            ...contact,
            avatar: {
              ...avatar,
              avatar: await upgradeAttachment(avatar.avatar, context),
            },
          }
        : omit(contact, ['avatar']);

    // eliminates empty numbers, emails, and addresses; adds type if not provided
    const parsedContact = parseContact(contactWithUpdatedAvatar, {
      regionCode: getRegionCode(),
    });

    const error = _validate(parsedContact, {
      messageId: idForLogging(message),
    });
    if (error) {
      logger.error(
        'parseAndWriteAvatar: contact was malformed.',
        toLogFormat(error)
      );
    }

    return parsedContact;
  };
}

function parseContact(
  contact: EmbeddedContactType,
  { regionCode }: { regionCode: string | undefined }
): EmbeddedContactType {
  const boundParsePhone = (phoneNumber: Phone): Phone | undefined =>
    parsePhoneItem(phoneNumber, { regionCode });

  const skipEmpty = <T>(arr: Array<T | undefined>): Array<T> | undefined => {
    const filtered: Array<T> = arr.filter(isNotNil);
    return filtered.length ? filtered : undefined;
  };

  const number = skipEmpty((contact.number || []).map(boundParsePhone));
  const email = skipEmpty((contact.email || []).map(parseEmailItem));
  const address = skipEmpty((contact.address || []).map(parseAddress));

  let result = {
    ...omit(contact, ['avatar', 'number', 'email', 'address']),
    ...parseAvatar(contact.avatar),
  };

  if (number) {
    result = { ...result, number };
  }
  if (email) {
    result = { ...result, email };
  }
  if (address) {
    result = { ...result, address };
  }
  return result;
}

function idForLogging(message: ReadonlyMessageAttributesType): string {
  return `${message.source}.${message.sourceDevice} ${message.sent_at}`;
}

// Exported for testing
export function _validate(
  contact: EmbeddedContactType,
  { messageId }: { messageId: string }
): Error | undefined {
  const { organization } = contact;

  if (!getDisplayName(contact) && !organization) {
    return new Error(
      `Message ${messageId}: Contact had neither 'displayName' nor 'organization'`
    );
  }

  return undefined;
}

export function parsePhoneItem(
  item: Phone,
  { regionCode }: { regionCode: string | undefined }
): Phone | undefined {
  if (!item.value) {
    return undefined;
  }

  const value = regionCode
    ? normalizePhoneNumber(item.value, { regionCode })
    : item.value;

  return {
    ...item,
    type: item.type || DEFAULT_PHONE_TYPE,
    value: value ?? item.value,
  };
}

function parseEmailItem(item: Email): Email | undefined {
  if (!item.value) {
    return undefined;
  }

  return { ...item, type: item.type || DEFAULT_EMAIL_TYPE };
}

function parseAddress(address: PostalAddress): PostalAddress | undefined {
  if (!address) {
    return undefined;
  }

  if (
    !address.street &&
    !address.pobox &&
    !address.neighborhood &&
    !address.city &&
    !address.region &&
    !address.postcode &&
    !address.country
  ) {
    return undefined;
  }

  return { ...address, type: address.type || DEFAULT_ADDRESS_TYPE };
}

function parseAvatar(avatar?: Avatar): { avatar: Avatar } | undefined {
  if (!avatar) {
    return undefined;
  }

  return {
    avatar: {
      ...avatar,
      isProfile: avatar.isProfile || false,
    },
  };
}
