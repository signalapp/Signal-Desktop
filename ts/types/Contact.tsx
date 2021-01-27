// @ts-ignore
export interface Contact {
  name?: Name;
  number?: Array<Phone>;
  avatar?: Avatar;
  organization?: string;
}

interface Name {
  givenName?: string;
  familyName?: string;
  prefix?: string;
  suffix?: string;
  middleName?: string;
  displayName?: string;
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

interface Avatar {
  avatar: Attachment;
  isProfile: boolean;
}

interface Attachment {
  path?: string;
  error?: boolean;
  pending?: boolean;
}

export function getName(contact: Contact): string | undefined {
  const { name, organization } = contact;
  const displayName = (name && name.displayName) || undefined;
  const givenName = (name && name.givenName) || undefined;
  const familyName = (name && name.familyName) || undefined;
  const backupName =
    (givenName && familyName && `${givenName} ${familyName}`) || undefined;

  return displayName || organization || backupName || givenName || familyName;
}
