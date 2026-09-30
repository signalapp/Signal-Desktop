// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

import {
  AciString,
  DeviceId,
  PniString,
  RegistrationId,
  ServiceIdString,
} from '../types';
import { fromBase64, fromURLSafeBase64 } from '../util';

export const PositiveInt = z.coerce.number().int().nonnegative();

export const AciSchema = z.string().transform((x) => x as AciString);
export const PniSchema = z
  .string()
  .refine((x) => x.startsWith('PNI:'))
  .transform((x) => x as PniString);
export const ServiceIdSchema = z
  .string()
  .transform((x) => x as ServiceIdString);
export const RegistrationIdSchema = z
  .number()
  .transform((x) => x as RegistrationId);
export const DeviceIdSchema = z.number().transform((x) => x as DeviceId);

const PreKeySchema = z.object({
  keyId: z.number(),
  publicKey: z.string(),
});
export type ServerPreKey = z.infer<typeof PreKeySchema>;

const SignedPreKeySchema = z.object({
  keyId: z.number(),
  publicKey: z.string(),
  signature: z.string(),
});
export type ServerSignedPreKey = z.infer<typeof SignedPreKeySchema>;

export const DeviceKeysSchema = z.object({
  preKeys: PreKeySchema.array(),
  pqPreKeys: SignedPreKeySchema.array().optional(),
  pqLastResortPreKey: SignedPreKeySchema.optional(),
  signedPreKey: SignedPreKeySchema.optional(),
});

export type DeviceKeys = z.infer<typeof DeviceKeysSchema>;

export const MessageSchema = z.object({
  // NOTE: Envelope.Type
  type: z.number(),
  destinationDeviceId: DeviceIdSchema,
  destinationRegistrationId: RegistrationIdSchema,
  content: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

export const MessageListSchema = z.object({
  messages: MessageSchema.array(),
  timestamp: z.number(),
});

export type MessageList = z.infer<typeof MessageListSchema>;

export const AtomicLinkingDataSchema = z.object({
  verificationCode: z.string(),
  accountAttributes: z.object({
    fetchesMessages: z.boolean(),
    registrationId: RegistrationIdSchema,
    pniRegistrationId: RegistrationIdSchema.optional(),
    name: z.string(),
  }),
  aciSignedPreKey: SignedPreKeySchema,
  aciPqLastResortPreKey: SignedPreKeySchema,
  pniSignedPreKey: SignedPreKeySchema.optional(),
  pniPqLastResortPreKey: SignedPreKeySchema.optional(),
});

export const UpdateProfileSchema = z.object({
  commitment: z.string(),
  version: z.string(),
  name: z.string(),
  aboutEmoji: z.string().nullish(),
  about: z.string().nullish(),
  paymentAddress: z.string().nullish(),
  avatar: z.boolean(),
  sameAvatar: z.boolean(),
  badgeIds: z.array(z.string()).nullish(),
  phoneNumberSharing: z.string().nullish(),
});
export type UploadProfileResponse =
  | string
  | undefined
  | {
      acl: string;
      algorithm: string;
      credential: string;
      date: string;
      key: string;
      policy: string;
      signature: string;
    };

export const RegisterAccountSchema = z.object({
  sessionId: z.string(),
  recoveryPassword: z.string().optional(),
  accountAttributes: z.object({
    fetchesMessages: z.boolean(),
    registrationId: RegistrationIdSchema,
    pniRegistrationId: RegistrationIdSchema.optional(),
    name: z.string().optional(),
    capabilities: z.object({
      attachmentBackfill: z.boolean(),
      spqr: z.boolean(),
      usernameChangeSyncMessage: z.boolean(),
      // TODO(indutny): read it
      optionalPhoneNumber: z.boolean().optional(),
    }),
    registrationLock: z.string().optional(),
    unidentifiedAccessKey: z.array(z.number()),
    unrestrictedUnidentifiedAccess: z.boolean(),
    discoverableByPhoneNumber: z.boolean(),
    recoveryPassword: z.string(),
    phoneNumberIdentityRegistrationId: z.string().optional(),
  }),
  skipDeviceTransfer: z.boolean(),
  aciIdentityKey: z.string(),
  pniIdentityKey: z.string(),
  aciSignedPreKey: SignedPreKeySchema,
  aciPqLastResortPreKey: SignedPreKeySchema,
  pniSignedPreKey: SignedPreKeySchema.optional(),
  pniPqLastResortPreKey: SignedPreKeySchema.optional(),
  apnToken: z
    .object({
      apnRegistrationId: z.string(),
    })
    .optional(),
  gcmToken: z
    .object({
      gcmRegistrationId: z.string(),
    })
    .optional(),
});
export type RegisterAccountResponse = {
  uuid: string;
  number: string;
  pni: string | undefined;
  usernameHash?: string;
  usernameLinkHandle?: string;
  storageCapable: boolean;
  entitlements: {
    badges: Array<{
      id: string;
      expirationSeconds: number;
      visible: boolean;
    }>;
    backup?: {
      backupLevel: number;
      expirationSeconds: number;
    };
  };
  reregistration: boolean;
};

export const PutRegistrationLockSchema = z.object({
  registrationLock: z.string(),
});

export const TransportSchema = z.literal('sms').or(z.literal('voice'));
export type Transport = z.infer<typeof TransportSchema>;
export const ClientTypeSchema = z
  .literal('desktop')
  .or(z.literal('ios'))
  .or(z.literal('android'));

export const ModifyVerificationSessionSchema = z.object({
  pushToken: z.string().optional(),
  pushTokenType: z.string().optional(),
  pushChallenge: z.string().optional(),
  captcha: z.string().optional(),
  mcc: z.string().optional(),
  mnc: z.string().optional(),
});
export const CreateVerificationSessionSchema = z.object({
  number: z.string(),
  ...ModifyVerificationSessionSchema.shape,
});

export type VerificationSession = {
  id: string;
  nextSms: number | null;
  nextCall: number | null;
  nextVerificationAttempt: number | null;
  allowedToRequestCode: boolean;
  requestedInformation: Array<'pushChallenges' | 'captcha'>;
  verified: boolean;
};
export type VerificationSessionStorage = {
  number: string;
  session: VerificationSession;
  lastRequestedCode?: string;
  lastRequestedTransport?: Transport;
};

export const RequestVerificationCodeSchema = z.object({
  transport: TransportSchema,
  client: ClientTypeSchema,
});
export const SubmitVerificationCodeSchema = z.object({
  code: z.string(),
});

export const GroupStateSchema = z.object({
  publicKey: z.instanceof(Uint8Array),
  version: z.literal(0),
  accessControl: z.object({
    attributes: z.number(),
    members: z.number(),
    addFromInviteLink: z.number(),
  }),
  members: z.unknown().array().min(1),
});

export const CreateCallLinkAuthSchema = z.object({
  createCallLinkCredentialRequest: z.string().transform(fromBase64),
});

export type CreateCallLinkAuth = z.infer<typeof CreateCallLinkAuthSchema>;

export const CreateCallLinkSchema = z.object({
  adminPasskey: z.string().transform(fromBase64),
  zkparams: z.string().transform(fromBase64),
});

export type CreateCallLink = z.infer<typeof CreateCallLinkSchema>;

export const UpdateCallLinkSchema = z.object({
  adminPasskey: z.string().transform(fromBase64),
  name: z.string().optional(),
  restrictions: z.enum(['none', 'adminApproval']).optional(),
  revoked: z.boolean().optional(),
});

export type UpdateCallLink = z.infer<typeof UpdateCallLinkSchema>;

export const DeleteCallLinkSchema = z.object({
  adminPasskey: z.string().transform(fromBase64),
});

export type DeleteCallLink = z.infer<typeof DeleteCallLinkSchema>;

export const SetBackupIdSchema = z.object({
  messagesBackupAuthCredentialRequest: z.string().transform(fromBase64),
  mediaBackupAuthCredentialRequest: z.string().transform(fromBase64),
});

export type SetBackupId = z.infer<typeof SetBackupIdSchema>;

export type BackupSignedPresentation = Readonly<{
  presentation: Uint8Array<ArrayBuffer>;
  presentationSignature: Uint8Array<ArrayBuffer>;
}>;

export const BackupHeadersSchema = z
  .object({
    'x-signal-zk-auth': z.string().transform(fromBase64),
    'x-signal-zk-auth-signature': z.string().transform(fromBase64),
  })
  .transform(
    (headers): BackupSignedPresentation => ({
      presentation: headers['x-signal-zk-auth'],
      presentationSignature: headers['x-signal-zk-auth-signature'],
    }),
  );

export const SetBackupKeySchema = z.object({
  backupIdPublicKey: z.string().transform(fromBase64),
});

export type SetBackupKey = z.infer<typeof SetBackupKeySchema>;

export const BackupMediaBatchSchema = z.object({
  items: z
    .object({
      sourceAttachment: z.object({
        cdn: z.number(),
        key: z.string(),
      }),
      objectLength: z.number(),
      mediaId: z.string(),
      hmacKey: z.string().transform(fromBase64),
      encryptionKey: z.string().transform(fromBase64),
    })
    .array(),
});

export type BackupMediaBatch = z.infer<typeof BackupMediaBatchSchema>;

export const UsernameConfirmationSchema = z.object({
  usernameHash: z.string().transform(fromURLSafeBase64),
  zkProof: z.string().transform(fromURLSafeBase64),
  encryptedUsername: z.string().transform(fromURLSafeBase64),
});
