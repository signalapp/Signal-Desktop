// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { themeSettingSchema } from './StorageUIKeys';
import { environmentSchema } from '../environment';

const configRequiredStringSchema = z.string().nonempty();
export type ConfigRequiredStringType = z.infer<
  typeof configRequiredStringSchema
>;

const configOptionalUnknownSchema = configRequiredStringSchema.or(z.unknown());

const configOptionalStringSchema = configRequiredStringSchema.or(z.undefined());
export type configOptionalStringType = z.infer<
  typeof configOptionalStringSchema
>;

const directoryLegacyConfigSchema = z.object({
  directoryType: z.literal('legacy'),
  directoryEnclaveId: configRequiredStringSchema,
  directoryTrustAnchor: configRequiredStringSchema,
  directoryUrl: configRequiredStringSchema,
});

const directoryCDSIConfigSchema = z.object({
  directoryType: z.literal('cdsi'),
  directoryCDSIUrl: configRequiredStringSchema,
  directoryCDSIMRENCLAVE: configRequiredStringSchema,
});

const directoryMirroredCDSIConfigSchema = z.object({
  directoryType: z.literal('mirrored-cdsi'),

  directoryEnclaveId: configRequiredStringSchema,
  directoryTrustAnchor: configRequiredStringSchema,
  directoryUrl: configRequiredStringSchema,

  directoryCDSIUrl: configRequiredStringSchema,
  directoryCDSIMRENCLAVE: configRequiredStringSchema,
});

export const directoryConfigSchema = z
  .object({
    // Unknown defaults
    directoryEnclaveId: configOptionalUnknownSchema,
    directoryTrustAnchor: configOptionalUnknownSchema,
    directoryUrl: configOptionalUnknownSchema,

    directoryCDSIUrl: configOptionalUnknownSchema,
    directoryCDSIMRENCLAVE: configOptionalUnknownSchema,
  })
  .and(
    directoryLegacyConfigSchema
      .or(directoryMirroredCDSIConfigSchema)
      .or(directoryCDSIConfigSchema)
  );

export type DirectoryConfigType = z.infer<typeof directoryConfigSchema>;

export const rendererConfigSchema = z.object({
  appInstance: configOptionalStringSchema,
  appStartInitialSpellcheckSetting: z.boolean(),
  buildCreation: z.number(),
  buildExpiration: z.number(),
  cdnUrl0: configRequiredStringSchema,
  cdnUrl2: configRequiredStringSchema,
  certificateAuthority: configRequiredStringSchema,
  contentProxyUrl: configRequiredStringSchema,
  crashDumpsPath: configRequiredStringSchema,
  enableCI: z.boolean(),
  environment: environmentSchema,
  homePath: configRequiredStringSchema,
  hostname: configRequiredStringSchema,
  locale: configRequiredStringSchema,
  name: configRequiredStringSchema,
  nodeVersion: configRequiredStringSchema,
  proxyUrl: configOptionalStringSchema,
  reducedMotionSetting: z.boolean(),
  serverPublicParams: configRequiredStringSchema,
  serverTrustRoot: configRequiredStringSchema,
  serverUrl: configRequiredStringSchema,
  sfuUrl: configRequiredStringSchema,
  storageUrl: configRequiredStringSchema,
  theme: themeSettingSchema,
  updatesUrl: configRequiredStringSchema,
  userDataPath: configRequiredStringSchema,
  version: configRequiredStringSchema,
  directoryConfig: directoryConfigSchema,

  // Only used by main window
  isMainWindowFullScreen: z.boolean(),
  isMainWindowMaximized: z.boolean(),

  // Only for tests
  argv: configOptionalStringSchema,

  // Only for permission popup window
  forCalling: z.boolean(),
  forCamera: z.boolean(),
});

export type RendererConfigType = z.infer<typeof rendererConfigSchema>;
