// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import { Buffer } from 'buffer';
import { Http2ServerRequest } from 'http2';
import { timingSafeEqual, randomBytes } from 'crypto';
import createDebug from 'debug';
import {
  CreateCallLinkCredentialRequest,
  ProfileKeyCredentialRequest,
} from '@signalapp/libsignal-client/zkgroup';
import { stringify as stringifyUuid, v4 as uuidv4 } from 'uuid';
import { KEMPublicKey, PublicKey } from '@signalapp/libsignal-client';

import WebSocket from 'ws';

import { signalservice as Proto } from '../../../protos/compiled';
import { Device } from '../../data/device';
import {
  AtomicLinkingDataSchema,
  CreateCallLinkAuthSchema,
  CreateVerificationSessionSchema,
  DeviceKeysSchema,
  MessageListSchema,
  ModifyVerificationSessionSchema,
  RegisterAccountResponse,
  RegisterAccountSchema,
  RequestVerificationCodeSchema,
  SetBackupIdSchema,
  SubmitVerificationCodeSchema,
  UpdateProfileSchema,
  UploadProfileResponse,
  UsernameConfirmationSchema,
  VerificationSession,
} from '../../data/schemas';
import {
  DeviceId,
  ProvisionIdString,
  ProvisioningCode,
  AciString,
  ServiceIdKind,
  ServiceIdString,
  untagPni,
} from '../../types';
import {
  decodeKyberPreKey,
  decodePreKey,
  decodeSignedPreKey,
  generateAccessKeyVerifier,
  hashRemoteConfig,
} from '../../crypto';
import { Server } from '../base';
import {
  booleanFromQuery,
  getDevicesKeysResult,
  parseAuthHeader,
  serviceIdKindFromQuery,
  toBase64,
} from '../../util';

import { Service, WSRequest, WSResponse } from './service';
import { Handler, Router } from './router';

const debug = createDebug('mock:ws:connection');

export class Connection extends Service {
  private device: Device | undefined;
  private readonly router = new Router({
    beforeRequest: (verb, path, headers) => {
      return this.handleAuth(verb, path, headers);
    },
  });

  constructor(
    private readonly request: Http2ServerRequest,
    ws: WebSocket,
    private readonly server: Server,
  ) {
    super(ws);

    const getProfile: Handler = async (
      params,
      _,
      headers,
      { credentialType } = {},
    ) => {
      const serviceId = params.serviceId as ServiceIdString;

      const target = await this.server.getDeviceByServiceId(serviceId);
      if (!target) {
        return [404, { error: 'Device not found' }];
      }

      if (this.server.isUnregistered(serviceId)) {
        return [404, { error: 'Unregistered' }];
      }

      const accessError = this.checkAccessKey(target, headers);
      if (accessError !== undefined) {
        return [401, { error: accessError }];
      }

      let credential: Buffer<ArrayBuffer> | undefined;
      if (params.request) {
        const request = new ProfileKeyCredentialRequest(
          Buffer.from(params.request, 'hex'),
        );
        if (credentialType === 'expiringProfileKey') {
          credential = await this.server.issueExpiringProfileKeyCredential(
            target,
            request,
          );
        } else {
          return [400, { error: 'Unsupported credential type' }];
        }
      }

      const serviceIdKind = target.getServiceIdKind(serviceId);
      const identityKey = await target.getIdentityKey(serviceIdKind);

      return [
        200,
        {
          name: target.profileName?.toString('base64'),
          identityKey: Buffer.from(identityKey.serialize()).toString('base64'),
          unrestrictedUnidentifiedAccess: false,
          unidentifiedAccess: target.accessKey
            ? generateAccessKeyVerifier(target.accessKey).toString('base64')
            : undefined,
          capabilities: target.capabilities,
          credential: credential?.toString('base64'),
        },
      ];
    };
    this.router.get('/v1/profile/:serviceId', getProfile);
    this.router.get('/v1/profile/:serviceId/:version', getProfile);
    this.router.get('/v1/profile/:serviceId/:version/:request', getProfile);

    const requireAuth = (handler: Handler): Handler => {
      return async (params, body, headers, query) => {
        if (!this.device) {
          return [401, { error: 'Not authorized' }];
        }

        return handler(params, body, headers, query);
      };
    };

    this.router.put(
      '/v1/profile',
      requireAuth(async (_params, body) => {
        if (!body) {
          return [400, { error: 'Missing body' }];
        }

        const parsedResult = UpdateProfileSchema.safeParse(
          JSON.parse(Buffer.from(body).toString()),
        );
        if (parsedResult.error) {
          debug('/v1/profile malformed body', parsedResult.error.message);

          return [400, { error: 'body is malformed' }];
        }

        const primaryDevice = this.device;
        if (!primaryDevice) {
          return [400, { error: 'missing device!' }];
        }

        const { data } = parsedResult;
        const { name } = data;

        primaryDevice.profileName = name
          ? Buffer.from(name, 'base64')
          : undefined;
        // Note: The other fields on UpdateProfileSchema are currently not saved on device

        const result: UploadProfileResponse = 'ok';
        return [200, result];
      }),
    );

    this.router.get(
      '/v1/config',
      requireAuth(async () => {
        return [
          200,
          {
            config: [...this.server.getRemoteConfig().entries()].map(
              ([key, value]) => {
                return { name: key, ...value };
              },
            ),
            serverEpochTime: Date.now() / 1000,
          },
        ] as const;
      }),
    );

    this.router.get(
      '/v2/config',
      requireAuth(async (_params, _body, headers) => {
        const enabledEntries = [...this.server.getRemoteConfig().entries()]
          .filter((entry) => entry[1].enabled)
          .map(([name, { value }]) => [name, value ?? 'true'] as const);
        // Sort by name then value.
        enabledEntries.sort(([n1, v1], [n2, v2]) => {
          if (n1 === n2) {
            return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
          }
          return n1 < n2 ? -1 : 1;
        });
        const hash = hashRemoteConfig(enabledEntries).toString('hex');

        const replyHeaders = { etag: hash };

        if (headers['if-none-match'] === hash) {
          return [304, '', replyHeaders];
        }

        return [
          200,
          {
            config: Object.fromEntries(enabledEntries),
          },
          replyHeaders,
        ] as const;
      }),
    );

    this.router.put(
      '/v1/messages/:serviceId',
      async (params, body, headers, query = {}) => {
        if (!body) {
          return [400, { error: 'Missing body' }];
        }

        const { messages, timestamp } = MessageListSchema.parse(
          JSON.parse(Buffer.from(body).toString()),
        );

        const targetServiceId = params.serviceId as ServiceIdString;
        const target = await this.server.getDeviceByServiceId(targetServiceId);
        if (!target) {
          return [404, { error: 'Device not found' }];
        }

        if (query.story !== 'true') {
          const accessError = this.checkAccessKey(target, headers);
          if (accessError !== undefined) {
            return [401, { error: accessError }];
          }
        }

        if (this.server.isUnregistered(targetServiceId)) {
          return [404, { error: 'Unregistered' }];
        }

        if (
          this.device &&
          this.server.isSendRateLimited({
            source: this.device.aci,
            target: targetServiceId,
          })
        ) {
          return [428, { token: 'token', options: ['captcha'] }];
        }

        const prepared = await this.server.prepareMultiDeviceMessage(
          this.device,
          params.serviceId as ServiceIdString,
          messages,
          BigInt(timestamp),
        );

        switch (prepared.status) {
          case 'ok':
            await this.server.handlePreparedMultiDeviceMessage(
              this.device,
              prepared.targetServiceId,
              prepared.result,
            );
            return [200, { ok: true }];
          case 'unknown':
            return [404, { error: 'Not found' }];
          case 'incomplete':
            return [
              409,
              {
                missingDevices: prepared.missingDevices,
                extraDevices: prepared.extraDevices,
              },
            ];
          case 'stale':
            return [410, { staleDevices: prepared.staleDevices }];
        }
      },
    );

    this.router.put(
      '/v1/devices/capabilities',
      requireAuth(async () => {
        return [200, { ok: true }];
      }),
    );

    this.router.put(
      '/v1/devices/unauthenticated_delivery',
      requireAuth(async () => {
        return [200, { ok: true }];
      }),
    );

    this.router.get(
      '/v1/certificate/delivery',
      requireAuth(async (_params, _rawBody, _headers, query) => {
        const certificate = await this.server.getSenderCertificate(
          this.getDevice(),
          { includeE164: booleanFromQuery(query?.includeE164, true) },
        );

        return [
          200,
          {
            certificate: Buffer.from(certificate.serialize()).toString(
              'base64',
            ),
          },
        ];
      }),
    );

    this.router.put(
      '/v2/keys',
      requireAuth(async (_params, rawBody, _headers, query) => {
        if (!rawBody) {
          return [422, { error: 'Missing body' }];
        }

        const serviceIdKind = serviceIdKindFromQuery(query);

        const body = DeviceKeysSchema.parse(JSON.parse(rawBody.toString()));
        try {
          await server.updateDeviceKeys(this.getDevice(), serviceIdKind, {
            preKeys: body.preKeys.map(decodePreKey),
            kyberPreKeys: body.pqPreKeys?.map(decodeKyberPreKey),
            lastResortKey: body.pqLastResortPreKey
              ? decodeKyberPreKey(body.pqLastResortPreKey)
              : undefined,
            signedPreKey: body.signedPreKey
              ? decodeSignedPreKey(body.signedPreKey)
              : undefined,
          });
        } catch (error) {
          assert(error instanceof Error);
          debug('updateDeviceKeys error', error.stack);
          return [400, { error: error.message }];
        }

        return [200, { ok: true }];
      }),
    );

    this.router.get(
      '/v2/keys',
      requireAuth(async (_params, _rawBody, _headers, query) => {
        const device = this.getDevice();
        const serviceIdKind = serviceIdKindFromQuery(query);

        return [
          200,
          {
            count: await device.getPreKeyCount(serviceIdKind),
            pqCount: await device.getKyberPreKeyCount(serviceIdKind),
          },
        ];
      }),
    );

    this.router.get('/v2/keys/:serviceId/:deviceId', async (params) => {
      const serviceId = params.serviceId as ServiceIdString | undefined;
      const deviceId = parseInt(params.deviceId ?? '', 10) as DeviceId;
      if (!serviceId || deviceId.toString() !== params.deviceId) {
        return [400, { error: 'Invalid request parameters' }];
      }

      const device = await server.getDeviceByServiceId(serviceId, deviceId);
      if (!device) {
        return [404, { error: 'Device not found' }];
      }

      const serviceIdKind = device.getServiceIdKind(serviceId);
      return [200, await getDevicesKeysResult(serviceIdKind, [device])];
    });

    this.router.get('/v2/keys/:serviceId(/\\*)', async (params) => {
      const serviceId = params.serviceId as ServiceIdString | undefined;
      if (!serviceId) {
        return [400, { error: 'Invalid request parameters' }];
      }

      const devices = await server.getAllDevicesByServiceId(serviceId);
      if (devices.length === 0) {
        return [404, { error: 'Account not found' }];
      }

      const device = devices[0];
      assert(device != null, `Missing first device for serviceId ${serviceId}`);
      const serviceIdKind = device.getServiceIdKind(serviceId);
      return [200, await getDevicesKeysResult(serviceIdKind, devices)];
    });

    this.router.put('/v1/devices/link', async (_params, body, headers) => {
      const { error, username, password } = parseAuthHeader(
        headers.authorization,
      );
      if (error) {
        return [400, { error }];
      }
      if (!username || !password) {
        return [400, { error: 'Invalid authorization header' }];
      }
      if (!body) {
        return [400, { error: 'Missing body' }];
      }

      const {
        verificationCode,
        accountAttributes,
        aciSignedPreKey,
        pniSignedPreKey,
        aciPqLastResortPreKey,
        pniPqLastResortPreKey,
      } = AtomicLinkingDataSchema.parse(
        JSON.parse(Buffer.from(body).toString()),
      );

      const { registrationId, pniRegistrationId } = accountAttributes;

      const device = await server.provisionDevice({
        aci: username as AciString,
        password,
        provisioningCode: verificationCode as ProvisioningCode,
        registrationId,
        pniRegistrationId,
      });

      const primary = await server.getDeviceByServiceId(device.aci);
      if (!primary) {
        throw new Error('Primary device not found');
      }

      await server.updateDeviceKeys(device, ServiceIdKind.ACI, {
        lastResortKey: decodeKyberPreKey(aciPqLastResortPreKey),
        signedPreKey: decodeSignedPreKey(aciSignedPreKey),
      });
      if (device.pni != null) {
        assert(
          pniPqLastResortPreKey != null && pniSignedPreKey != null,
          'Missing required PNI key material',
        );
        await server.updateDeviceKeys(device, ServiceIdKind.PNI, {
          lastResortKey: decodeKyberPreKey(pniPqLastResortPreKey),
          signedPreKey: decodeSignedPreKey(pniSignedPreKey),
        });
      }

      return [
        200,
        {
          deviceId: device.deviceId,
          uuid: device.aci,
          pni: device.pni ? untagPni(device.pni) : undefined,
        },
      ];
    });

    this.router.get(
      '/v1/devices/transfer_archive',
      requireAuth(async () => {
        return [200, await server.getTransferArchive(this.getDevice())];
      }),
    );

    //
    // Verification and Account Create
    //

    this.router.post('/v1/verification/session', async (_params, body) => {
      if (!body) {
        debug('missing body');
        return [400, { error: 'missing body' }];
      }

      const parsedResult = CreateVerificationSessionSchema.safeParse(
        JSON.parse(Buffer.from(body).toString()),
      );
      if (parsedResult.error) {
        debug(
          '/v1/verification/session malformed body',
          parsedResult.error.message,
        );
        return [400, { error: 'malformed body' }];
      }

      const { data } = parsedResult;

      const session: VerificationSession = {
        id: uuidv4(),
        nextSms: 60,
        nextCall: 60,
        nextVerificationAttempt: null,
        allowedToRequestCode: false,
        requestedInformation: ['captcha'],
        verified: false,
      };
      this.server.saveVerificationSession({
        number: data.number,
        session,
      });

      return [200, session];
    });

    this.router.get('/v1/verification/session/:sessionId', async (params) => {
      const { sessionId } = params;
      if (!sessionId) {
        return [400, { error: 'sessionId parameter is missing' }];
      }

      const storage = this.server.getVerificationSession(sessionId);
      if (!storage) {
        return [404, { error: `No session found with sessionId ${sessionId}` }];
      }

      return [200, storage.session];
    });

    this.router.patch(
      '/v1/verification/session/:sessionId',
      async (params, body) => {
        if (!body) {
          return [400, { error: 'missing body' }];
        }

        const { sessionId } = params;
        if (!sessionId) {
          return [400, { error: 'sessionId parameter is missing' }];
        }

        const storage = this.server.getVerificationSession(sessionId);
        if (!storage) {
          return [
            404,
            { error: `No session found with sessionId ${sessionId}` },
          ];
        }

        const parsedResult = ModifyVerificationSessionSchema.safeParse(
          JSON.parse(Buffer.from(body).toString()),
        );
        if (parsedResult.error) {
          debug(
            '/v1/verification/session/:sessionId malformed body',
            parsedResult.error.message,
          );
          return [400, { error: 'malformed body' }];
        }

        const { data } = parsedResult;
        const { session } = storage;
        if (data.captcha) {
          session.allowedToRequestCode = true;
        }

        this.server.saveVerificationSession({ ...storage, session });

        return [200, session];
      },
    );

    this.router.put(
      '/v1/verification/session/:sessionId/code',
      async (params, body) => {
        if (!body) {
          return [400, { error: 'missing body' }];
        }

        const { sessionId } = params;
        if (!sessionId) {
          return [400, { error: 'sessionId parameter is missing' }];
        }

        const storage = this.server.getVerificationSession(sessionId);
        if (!storage) {
          return [
            404,
            { error: `No session found with sessionId ${sessionId}` },
          ];
        }

        const parsedResult = SubmitVerificationCodeSchema.safeParse(
          JSON.parse(Buffer.from(body).toString()),
        );
        if (parsedResult.error) {
          debug(
            '/v1/verification/session/:sessionId/code malformed body',
            parsedResult.error.message,
          );
          return [400, { error: 'malformed body' }];
        }

        if (storage.lastRequestedCode !== parsedResult.data.code) {
          const { session } = storage;
          session.verified = false;

          this.server.saveVerificationSession(storage);

          return [200, session];
        }

        storage.lastRequestedCode = undefined;
        storage.lastRequestedTransport = undefined;

        const { session } = storage;
        session.verified = true;

        this.server.saveVerificationSession(storage);

        return [200, session];
      },
    );

    this.router.post(
      '/v1/verification/session/:sessionId/code',
      async (params, body) => {
        if (!body) {
          return [400, { error: 'missing body' }];
        }

        const { sessionId } = params;
        if (!sessionId) {
          return [400, { error: 'sessionId parameter is missing' }];
        }

        const storage = this.server.getVerificationSession(sessionId);
        if (!storage) {
          return [
            404,
            { error: `No session found with sessionId ${sessionId}` },
          ];
        }

        const parsedResult = RequestVerificationCodeSchema.safeParse(
          JSON.parse(Buffer.from(body).toString()),
        );
        if (parsedResult.error) {
          debug(
            '/v1/verification/session/:sessionId/code malformed body',
            parsedResult.error.message,
          );
          return [400, { error: 'malformed body' }];
        }

        const { data } = parsedResult;
        storage.lastRequestedCode = '111111';
        storage.lastRequestedTransport = data.transport;

        const { session } = storage;
        session.nextCall = 60;
        session.nextSms = 60;

        this.server.saveVerificationSession(storage);

        return [200, session];
      },
    );

    this.router.post('/v1/registration', async (_params, body, headers) => {
      const { error, password } = parseAuthHeader(headers.authorization);

      if (error) {
        return [400, { error }];
      }
      if (!password) {
        return [400, { error: 'password not provided' }];
      }

      if (!body) {
        return [400, { error: 'missing body' }];
      }

      const parsedResult = RegisterAccountSchema.safeParse(
        JSON.parse(Buffer.from(body).toString()),
      );
      if (parsedResult.error) {
        debug('/v1/registration malformed body', parsedResult.error.message);
        return [400, { error: 'malformed body' }];
      }

      const { data } = parsedResult;
      const { accountAttributes, sessionId } = data;
      const { pniRegistrationId, registrationId } = accountAttributes;

      const storage = this.server.getVerificationSession(sessionId);
      if (!storage) {
        return [404, { error: `No session found with sessionId ${sessionId}` }];
      }

      const { session } = storage;
      if (!session.verified) {
        return [400, { error: 'session is not verified' }];
      }

      const hardcodedError = this.server.getRegisterResponseError();
      if (hardcodedError) {
        return [hardcodedError.code, hardcodedError.data];
      }

      const { number } = storage;

      const provisionId = await server.generateProvisionId();
      const primaryDevice = await server.registerDevice({
        provisionId,
        number,
        password,
        pniRegistrationId,
        registrationId,
        // TODO(inutny): take as an input
        authCredentialSalt: randomBytes(16),
      });

      const {
        aciSignedPreKey,
        aciPqLastResortPreKey,
        aciIdentityKey,
        pniSignedPreKey,
        pniPqLastResortPreKey,
        pniIdentityKey,
      } = data;

      await primaryDevice.setKeys(ServiceIdKind.ACI, {
        identityKey: PublicKey.deserialize(
          Buffer.from(aciIdentityKey, 'base64'),
        ),
        signedPreKey: {
          keyId: aciSignedPreKey.keyId,
          publicKey: PublicKey.deserialize(
            Buffer.from(aciSignedPreKey.publicKey, 'base64'),
          ),
          signature: Buffer.from(aciSignedPreKey.signature, 'base64'),
        },
        lastResortKey: {
          keyId: aciPqLastResortPreKey.keyId,
          publicKey: KEMPublicKey.deserialize(
            Buffer.from(aciPqLastResortPreKey.publicKey, 'base64'),
          ),
          signature: Buffer.from(aciPqLastResortPreKey.signature, 'base64'),
        },
      });

      if (primaryDevice.pni != null) {
        assert(
          pniSignedPreKey != null && pniPqLastResortPreKey != null,
          'Missing required PNI key material',
        );
        await primaryDevice.setKeys(ServiceIdKind.PNI, {
          identityKey: PublicKey.deserialize(
            Buffer.from(pniIdentityKey, 'base64'),
          ),
          signedPreKey: {
            keyId: pniSignedPreKey.keyId,
            publicKey: PublicKey.deserialize(
              Buffer.from(pniSignedPreKey.publicKey, 'base64'),
            ),
            signature: Buffer.from(pniSignedPreKey.signature, 'base64'),
          },
          lastResortKey: {
            keyId: pniPqLastResortPreKey.keyId,
            publicKey: KEMPublicKey.deserialize(
              Buffer.from(pniPqLastResortPreKey.publicKey, 'base64'),
            ),
            signature: Buffer.from(pniPqLastResortPreKey.signature, 'base64'),
          },
        });
      }

      const mixinData = this.server.getRegisterResponseData();

      const result: RegisterAccountResponse = {
        uuid: primaryDevice.aci.toString(),
        number,
        pni: primaryDevice.pni?.toString().replace(/^PNI:/i, ''),
        storageCapable: false,
        entitlements: {
          badges: [],
        },
        reregistration: false,
        ...mixinData,
      };

      return [200, result];
    });

    //
    // Groups
    //

    this.router.get(
      '/v1/certificate/auth/group',
      async (_params, _body, _headers, query = {}) => {
        const device = this.device;
        if (!device) {
          debug(
            '/v1/certificate/auth/group: No support for unauthorized delivery',
          );
          return [401, { error: 'Not authorized' }];
        }

        const { redemptionStartSeconds: from, redemptionEndSeconds: to } =
          query;

        return [
          200,
          {
            credentials: await this.server.getGroupCredentials(device, {
              from: parseInt(from as string, 10),
              to: parseInt(to as string, 10),
            }),
            callLinkAuthCredentials:
              await this.server.getCallLinkAuthCredentials(device, {
                from: parseInt(from as string, 10),
                to: parseInt(to as string, 10),
              }),
            pni: device.pni ? untagPni(device.pni) : undefined,
          },
        ];
      },
    );

    //
    // Storage Service
    //

    this.router.get(
      '/v1/storage/auth',
      requireAuth(async () => {
        return [200, await server.getStorageAuth(this.getDevice())];
      }),
    );

    //
    // Backups
    //

    this.router.get(
      '/v2/backup/auth',
      requireAuth(async () => {
        return [200, this.server.getBackupAuth()];
      }),
    );

    this.router.put(
      '/v1/archives/backupid',
      requireAuth(async (_params, body) => {
        if (!body) {
          return [400, { error: 'Missing body' }];
        }

        const backupId = SetBackupIdSchema.parse(JSON.parse(body.toString()));
        await server.setBackupId(this.getDevice(), backupId);
        return [200, { ok: true }];
      }),
    );

    this.router.get(
      '/v1/archives/auth',
      requireAuth(async (_params, _body, _headers, query = {}) => {
        const { redemptionStartSeconds: from, redemptionEndSeconds: to } =
          query;

        const credentials = await this.server.getBackupCredentials(
          this.getDevice(),
          {
            from: parseInt(from as string, 10),
            to: parseInt(to as string, 10),
          },
        );
        if (credentials === undefined) {
          return [404, { error: 'backup id not set' }];
        }

        return [
          200,
          {
            credentials,
          },
        ];
      }),
    );

    //
    // Keepalive
    //

    this.router.get('/v1/keepalive', async () => {
      return [200, { ok: true }];
    });

    //
    // Accounts
    //

    this.router.get(
      '/v1/accounts/whoami',
      requireAuth(async () => {
        const device = this.getDevice();
        return [
          200,
          {
            uuid: device.aci,
            pni: device.pni ? untagPni(device.pni) : undefined,
            number: device.number,
          },
        ];
      }),
    );

    //
    // Call links
    //

    this.router.post(
      '/v1/call-link/create-auth',
      requireAuth(async (_params, rawBody) => {
        if (!rawBody) {
          return [422, { error: 'Missing body' }];
        }

        const body = CreateCallLinkAuthSchema.parse(
          JSON.parse(rawBody.toString()),
        );
        const request = new CreateCallLinkCredentialRequest(
          body.createCallLinkCredentialRequest,
        );
        const response = await server.createCallLinkAuth(
          this.getDevice(),
          request,
        );

        return [
          200,
          {
            redemptionTime: -Date.now(),
            credential: toBase64(response.serialize()),
          },
        ];
      }),
    );

    //
    // Captcha
    //
    this.router.put(
      '/v1/challenge',
      requireAuth(async () => {
        const response = server.getResponseForChallenges();
        if (response) {
          return [response.code, response.data ?? {}];
        }

        return [200, { ok: true }];
      }),
    );

    this.router.get(
      '/v2/calling/relays',
      requireAuth(async () => [
        200,
        {
          relays: [
            {
              username: 'ignored',
              password: 'ignored',
              ttl: 43200,
              urls: ['turn:localhost'],
              urlsWithIps: ['turn:127.0.0.1'],
              hostname: 'localhost',
            },
          ],
        },
      ]),
    );

    // Temporary endpoint until gRPC migration is completed
    this.router.put(
      '/v1/accounts/username_hash/confirm',
      requireAuth(async (_params, rawBody) => {
        if (!rawBody) {
          return [422, { error: 'Missing body' }];
        }

        const {
          usernameHash,
          zkProof,
          encryptedUsername: usernameCiphertext,
        } = UsernameConfirmationSchema.parse(JSON.parse(rawBody.toString()));

        const result = await server.confirmUsername(this.getDevice().aci, {
          usernameHash,
          zkProof,
          usernameCiphertext,
        });

        if (!result) {
          return [
            409,
            {
              error:
                "Given username hash doesn't match the reserved one or no reservation found.",
            },
          ];
        }

        return [
          200,
          {
            usernameLinkHandle: stringifyUuid(result.usernameLinkHandle),
          },
        ];
      }),
    );
  }

  public async start(socket: WebSocket): Promise<void> {
    debug('Got a websocket connection', this.request.url);
    const url = this.request.url;
    if (!url) {
      throw new Error('Request must have url');
    }
    // Use a fixed string instead of constructing the URL from the HOST header
    // since we don't actually care about anything but the path.
    const path = new URL(url, 'http://localhost').pathname;

    if (path.startsWith('/v1/websocket/provisioning')) {
      const id = await this.server.generateProvisionId();
      try {
        await this.handleProvision(id, socket);
      } catch (error) {
        await this.server.releaseProvisionId(id);
        throw error;
      }
      return;
    }

    if (path === '/v1/websocket/') {
      await this.handleAuthHeaders(this.request.headers);
      return;
    }

    debug('websocket connection has unexpected URL %s', url);
  }

  public async sendMessage(
    message: Buffer<ArrayBuffer> | 'empty',
  ): Promise<void> {
    let response;
    if (message === 'empty') {
      response = await this.send('PUT', '/api/v1/queue/empty', {});
    } else {
      response = await this.send('PUT', '/api/v1/message', {
        body: message,
      });
    }

    assert.strictEqual(
      response.status,
      200,
      `WebSocket send error ${response.status} ${response.message}`,
    );
  }

  public close(code: number): void {
    this.ws.close(code);
  }

  //
  // Service implementation
  //

  protected async handleRequest(request: WSRequest): Promise<WSResponse> {
    return this.router.run(request);
  }

  //
  // Private
  //

  private async handleProvision(id: ProvisionIdString, socket: WebSocket) {
    {
      const { status } = await this.send('PUT', '/v1/address', {
        body: Proto.ProvisioningAddress.encode({
          address: id,
        }),
      });
      assert.strictEqual(status, 200);
    }

    const controller = new AbortController();
    socket.on('close', () => {
      debug('provision websocket closed; shutting down provisioning');
      controller.abort();
    });

    {
      const { envelope } = await this.server.getProvisioningResponse(
        id,
        controller.signal,
      );
      const { status } = await this.send('PUT', '/v1/message', {
        body: envelope,
      });
      assert.strictEqual(status, 200);
    }
  }

  private async handleAuth(
    verb: string,
    path: string,
    headers: Record<string, string>,
  ) {
    // We are actively linking device
    if (verb === 'PUT' && path === '/v1/devices/link') {
      return;
    }
    // We are actively registering an account
    if (verb === 'POST' && path === '/v1/registration') {
      return;
    }

    await this.handleAuthHeaders(headers);
  }

  private async handleAuthHeaders(
    headers: Record<string, string | Array<string> | undefined>,
  ) {
    const authHeaders = headers.authorization;
    if (authHeaders === undefined) {
      debug('Websocket connection does not include Authorization header');
      return;
    }
    if (Array.isArray(authHeaders)) {
      debug('Websocket connection includes multiple Authorization headers');
      return;
    }
    const { error, username, password } = parseAuthHeader(authHeaders, {
      allowEmptyPassword: true,
    });

    if (error || !username) {
      debug(
        'Invalid Authorization header for websocket connection @ %s: %s',
        error,
        authHeaders,
      );
      return;
    }

    const device = await this.server.auth(username, password);
    if (!device) {
      debug('Invalid WebSocket credentials @ %j', {
        username,
        password,
      });
      this.ws.close(3000);
      return;
    }

    if (this.device !== undefined) {
      assert.strictEqual(this.device, device, 'Cannot change active device');
      return;
    }

    this.device = device;
    this.router.setIsAuthenticated(true);

    this.ws.once('close', () => {
      this.server.removeWebSocket(device, this);
    });

    await this.server.addWebSocket(device, this);
  }

  private getDevice(): Device {
    assert(this.device);
    return this.device;
  }

  private checkAccessKey(
    target: Device,
    headers: Record<string, string>,
  ): string | undefined {
    if (this.device) {
      // Authenticated
    } else if (headers['group-send-token']) {
      // Unchecked
      return undefined;
    } else if (!target.accessKey || !headers['unidentified-access-key']) {
      return 'Not authenticated';
    } else {
      const accessKey = Buffer.from(
        headers['unidentified-access-key'],
        'base64',
      );
      if (!timingSafeEqual(accessKey, target.accessKey)) {
        return 'Invalid access key';
      }
    }

    return undefined;
  }
}
