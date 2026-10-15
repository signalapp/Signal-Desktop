// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import { SignalService as Proto } from '../protobuf/index.std.ts';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';

import { combineNames } from '../util/combineNames.std.ts';
import { isNotNil } from '../util/isNotNil.std.ts';
import { normalize as normalizePhoneNumber } from './PhoneNumber.std.ts';
import type {
  AttachmentType,
  AttachmentForUIType,
  AttachmentWithHydratedData,
  UploadedAttachmentType,
} from './Attachment.std.ts';
import { toLogFormat } from './errors.std.ts';
import type { AciString } from './ServiceId.std.ts';
import type { migrateDataToFileSystem } from '../util/attachments/migrateDataToFilesystem.std.ts';
import type { ContextType } from './Message2.preload.ts';
import type { SharedContactResolutionType } from '../util/sharedContact.std.ts';

const { omit } = lodash;

type GenericEmbeddedContactType<AvatarType> = {
  name?: Name;
  number?: ReadonlyArray<Phone>;
  email?: ReadonlyArray<Email>;
  address?: ReadonlyArray<PostalAddress>;
  avatar?: AvatarType;
  organization?: string;
  aci: AciString | undefined;
  nickname: Nickname | undefined;
  note: string | undefined;
};

export type EmbeddedContactType = GenericEmbeddedContactType<Avatar>;
export type EmbeddedContactWithAvatarForUIType =
  GenericEmbeddedContactType<AvatarForUI>;
export type EmbeddedContactForUIType = EmbeddedContactWithAvatarForUIType & {
  resolution: SharedContactResolutionType;
};

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

type Nickname = {
  givenName: string | undefined;
  familyName: string | undefined;
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
  avatar?: Attachment;
  isProfile: boolean;
};

export type Avatar = GenericAvatar<AttachmentType>;
export type AvatarForUI = GenericAvatar<AttachmentForUIType>;
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

export function getDisplayName(
  contact: ReadonlyDeep<EmbeddedContactType>
): string | undefined {
  const { name } = contact;
  return combineNames(name?.givenName, name?.familyName);
}

export function getDisplayNickname(
  contact: ReadonlyDeep<EmbeddedContactType>
): string | undefined {
  const { nickname } = contact;
  return combineNames(nickname?.givenName, nickname?.familyName);
}

export function parseAndWriteAvatar(
  upgradeAttachment: typeof migrateDataToFileSystem
) {
  return async (
    contact: EmbeddedContactType,
    context: Pick<
      ContextType,
      | 'getRegionCode'
      | 'logger'
      | 'writeNewAttachmentData'
      | 'getExistingAttachmentDataForReuse'
      | 'getPlaintextHashForInMemoryAttachment'
    >,
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
