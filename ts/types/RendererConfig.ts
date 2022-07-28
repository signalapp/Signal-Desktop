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

const directoryV1ConfigSchema = z.object({
  directoryVersion: z.literal(1),
  directoryEnclaveId: configRequiredStringSchema,
  directoryTrustAnchor: configRequiredStringSchema,
  directoryUrl: configRequiredStringSchema,
});

const directoryV2ConfigSchema = z.object({
  directoryVersion: z.literal(2),
  directoryV2CodeHashes: z.array(z.string().nonempty()),
  directoryV2PublicKey: configRequiredStringSchema,
  directoryV2Url: configRequiredStringSchema,
});

const directoryV3ConfigSchema = z.object({
  directoryVersion: z.literal(3),
  directoryV3Url: configRequiredStringSchema,
  directoryV3MRENCLAVE: configRequiredStringSchema,
});

export const directoryConfigSchema = z
  .object({
    // Unknown defaults
    directoryEnclaveId: configOptionalUnknownSchema,
    directoryTrustAnchor: configOptionalUnknownSchema,
    directoryUrl: configOptionalUnknownSchema,
    directoryV2CodeHashes: configOptionalUnknownSchema,
    directoryV2PublicKey: configOptionalUnknownSchema,
    directoryV2Url: configOptionalUnknownSchema,
    directoryV3Url: configOptionalUnknownSchema,
    directoryV3MRENCLAVE: configOptionalUnknownSchema,
  })
  .and(
    directoryV1ConfigSchema
      .or(directoryV2ConfigSchema)
      .or(directoryV3ConfigSchema)
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
