// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import fs from 'fs/promises';
import crypto from 'crypto';
import path, { join } from 'path';
import os from 'os';
import { PassThrough } from 'node:stream';
import createDebug from 'debug';
import pTimeout from 'p-timeout';
import normalizePath from 'normalize-path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { Page } from 'playwright';
import { v4 as uuid } from 'uuid';

import type { Device, PrimaryDevice, Proto } from '@signalapp/mock-server';
import {
  Server,
  ServiceIdKind,
  loadCertificates,
} from '@signalapp/mock-server';
import { MAX_READ_KEYS as MAX_STORAGE_READ_KEYS } from '../services/storageConstants';
import { SECOND, MINUTE, WEEK, MONTH } from '../util/durations';
import { drop } from '../util/drop';
import { regress } from '../util/benchmark/stats';
import type { RendererConfigType } from '../types/RendererConfig';
import type { MIMEType } from '../types/MIME';
import { App } from './playwright';
import { CONTACT_COUNT } from './benchmarks/fixtures';
import { strictAssert } from '../util/assert';
import {
  encryptAttachmentV2,
  generateAttachmentKeys,
} from '../AttachmentCrypto';

export { App };

const debug = createDebug('mock:bootstrap');

const ELECTRON = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  '.bin',
  'electron'
);
const CI_SCRIPT = path.join(__dirname, '..', '..', 'ci.js');

const CLOSE_TIMEOUT = 10 * 1000;

const CONTACT_FIRST_NAMES = [
  'Alice',
  'Bob',
  'Charlie',
  'Danielle',
  'Elaine',
  'Frankie',
  'Grandma',
  'Paul',
  'Steve',
  'William',
];
const CONTACT_LAST_NAMES = [
  'Smith',
  'Brown',
  'Jones',
  'Miller',
  'Davis',
  'Lopez',
  'Gonzales',
  'Singh',
  'Baker',
  'Farmer',
];

const CONTACT_SUFFIXES = [
  'Sr.',
  'Jr.',
  'the 3rd',
  'the 4th',
  'the 5th',
  'the 6th',
  'the 7th',
  'the 8th',
  'the 9th',
  'the 10th',
];

const CONTACT_NAMES = new Array<string>();
for (const firstName of CONTACT_FIRST_NAMES) {
  for (const lastName of CONTACT_LAST_NAMES) {
    CONTACT_NAMES.push(`${firstName} ${lastName}`);
  }
}

for (const suffix of CONTACT_SUFFIXES) {
  for (const firstName of CONTACT_FIRST_NAMES) {
    for (const lastName of CONTACT_LAST_NAMES) {
      CONTACT_NAMES.push(`${firstName} ${lastName}, ${suffix}`);
    }
  }
}

const MAX_CONTACTS = CONTACT_NAMES.length;

export type BootstrapOptions = Readonly<{
  benchmark?: boolean;

  linkedDevices?: number;
  contactCount?: number;
  contactsWithoutProfileKey?: number;
  unknownContactCount?: number;
  contactNames?: ReadonlyArray<string>;
  contactPreKeyCount?: number;

  useLegacyStorageEncryption?: boolean;
}>;

export type EphemeralBackupType = Readonly<{
  cdn: 3;
  key: string;
}>;

export type LinkOptionsType = Readonly<{
  extraConfig?: Partial<RendererConfigType>;
  ephemeralBackup?: EphemeralBackupType;
}>;

type BootstrapInternalOptions = BootstrapOptions &
  Readonly<{
    benchmark: boolean;
    linkedDevices: number;
    contactCount: number;
    contactsWithoutProfileKey: number;
    unknownContactCount: number;
    contactNames: ReadonlyArray<string>;
  }>;

export type RegressionBenchmarkOptions = Readonly<{
  fromValue: number;
  toValue: number;
  iterationCount?: number;
  maxCycles?: number;
  maxError?: number;
  timeout?: number;
}>;

export type RegressionBenchmarkFnOptions = Readonly<{
  bootstrap: Bootstrap;
  iteration: number;
  value: number;
}>;

export type RegressionSample = Readonly<{
  [key: `${string}Duration`]: number;

  // Metrics independent of the regressed value
  metrics?: Record<string, number>;
}>;

function sanitizePathComponent(component: string): string {
  return normalizePath(component.replace(/[^a-z]+/gi, '-'));
}

const DEFAULT_REMOTE_CONFIG = [
  ['desktop.backup.credentialFetch', { enabled: true }],
  ['desktop.internalUser', { enabled: true }],
  ['desktop.releaseNotes', { enabled: true }],
  ['desktop.senderKey.retry', { enabled: true }],
  ['global.groupsv2.groupSizeHardLimit', { enabled: true, value: '64' }],
  ['global.groupsv2.maxGroupSize', { enabled: true, value: '32' }],
] as const;

//
// Bootstrap is a class that prepares mock server and desktop for running
// tests/benchmarks.
//
// In general, the usage pattern is:
//
//   const bootstrap = new Bootstrap();
//   await bootstrap.init();
//   const app = await bootstrap.link();
//   await bootstrap.teardown();
//
// Once initialized `bootstrap` variable will have following useful properties:
//
// - `server` - a mock server instance
// - `desktop` - a linked device representing currently running desktop instance
// - `phone` - a primary device representing desktop's primary
// - `contacts` - a list of primary devices for contacts that are synced over
//   through contact sync
//
// `bootstrap.getTimestamp()` could be used to generate consecutive timestamp
// for sending messages.
//
// All phone numbers and uuids for all contacts and ourselves are random and not
// the same between different test runs.
//
export class Bootstrap {
  public readonly server: Server;
  public readonly cdn3Path: string;

  readonly #options: BootstrapInternalOptions;
  #privContacts?: ReadonlyArray<PrimaryDevice>;
  #privContactsWithoutProfileKey?: ReadonlyArray<PrimaryDevice>;
  #privUnknownContacts?: ReadonlyArray<PrimaryDevice>;
  #privPhone?: PrimaryDevice;
  #privDesktop?: Device;
  #storagePath?: string;
  #timestamp: number = Date.now() - WEEK;
  #lastApp?: App;
  readonly #randomId = crypto.randomBytes(8).toString('hex');

  constructor(options: BootstrapOptions = {}) {
    this.cdn3Path = path.join(
      os.tmpdir(),
      `mock-signal-cdn3-${this.#randomId}`
    );
    this.server = new Server({
      // Limit number of storage read keys for easier testing
      maxStorageReadKeys: MAX_STORAGE_READ_KEYS,
      cdn3Path: this.cdn3Path,
      updates2Path: path.join(__dirname, 'updates-data'),
    });

    this.#options = {
      linkedDevices: 5,
      contactCount: CONTACT_COUNT,
      contactsWithoutProfileKey: 0,
      unknownContactCount: 0,
      contactNames: CONTACT_NAMES,
      benchmark: false,

      ...options,
    };

    const totalContactCount =
      this.#options.contactCount +
      this.#options.contactsWithoutProfileKey +
      this.#options.unknownContactCount;
    assert(totalContactCount <= this.#options.contactNames.length);
    assert(totalContactCount <= MAX_CONTACTS);
  }

  public async init(): Promise<void> {
    debug('initializing');

    await this.server.listen(0);

    const { port } = this.server.address();
    debug('started server on port=%d', port);

    const totalContactCount =
      this.#options.contactCount +
      this.#options.contactsWithoutProfileKey +
      this.#options.unknownContactCount;

    const allContacts = await Promise.all(
      this.#options.contactNames
        .slice(0, totalContactCount)
        .map(async profileName => {
          const primary = await this.server.createPrimaryDevice({
            profileName,
          });

          for (let i = 0; i < this.#options.linkedDevices; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await this.server.createSecondaryDevice(primary);
          }

          return primary;
        })
    );

    this.#privContacts = allContacts.splice(0, this.#options.contactCount);
    this.#privContactsWithoutProfileKey = allContacts.splice(
      0,
      this.#options.contactsWithoutProfileKey
    );
    this.#privUnknownContacts = allContacts.splice(
      0,
      this.#options.unknownContactCount
    );

    this.#privPhone = await this.server.createPrimaryDevice({
      profileName: 'Myself',
      contacts: this.contacts,
      contactsWithoutProfileKey: this.contactsWithoutProfileKey,
    });
    if (this.#options.useLegacyStorageEncryption) {
      this.#privPhone.storageRecordIkm = undefined;
    }

    this.#storagePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mock-signal-')
    );

    DEFAULT_REMOTE_CONFIG.forEach(([key, value]) =>
      this.server.setRemoteConfig(key, value)
    );

    debug('setting storage path=%j', this.#storagePath);
  }

  public static benchmark(
    fn: (bootstrap: Bootstrap) => Promise<void>,
    timeout = 5 * MINUTE
  ): void {
    drop(Bootstrap.runBenchmark(fn, timeout));
  }

  public static regressionBenchmark(
    fn: (fnOptions: RegressionBenchmarkFnOptions) => Promise<RegressionSample>,
    options: RegressionBenchmarkOptions
  ): void {
    drop(Bootstrap.runRegressionBenchmark(fn, options));
  }

  public get logsDir(): string {
    assert(
      this.#storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    return path.join(this.#storagePath, 'logs');
  }

  public get ephemeralConfigPath(): string {
    assert(
      this.#storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    return path.join(this.#storagePath, 'ephemeral.json');
  }

  public eraseStorage(): Promise<void> {
    return this.#resetAppStorage();
  }

  async #resetAppStorage(): Promise<void> {
    assert(
      this.#storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    await fs.rm(this.#storagePath, { recursive: true });
    this.#storagePath = await fs.mkdtemp(
      path.join(os.tmpdir(), 'mock-signal-')
    );
  }

  public async teardown(): Promise<void> {
    debug('tearing down');

    await Promise.race([
      Promise.all([
        ...[this.#storagePath, this.cdn3Path].map(tmpPath =>
          tmpPath ? fs.rm(tmpPath, { recursive: true }) : Promise.resolve()
        ),
        this.server.close(),
        this.#lastApp?.close(),
      ]),
      new Promise(resolve => setTimeout(resolve, CLOSE_TIMEOUT).unref()),
    ]);
  }

  public async link({
    extraConfig,
    ephemeralBackup,
  }: LinkOptionsType = {}): Promise<App> {
    debug('linking');

    const app = await this.startApp(extraConfig);

    const window = await app.getWindow();

    debug('looking for QR code or relink button');
    const qrCode = window.locator(
      '.module-InstallScreenQrCodeNotScannedStep__qr-code__code'
    );
    const relinkButton = window.locator('.LeftPaneDialog__icon--relink');
    await qrCode.or(relinkButton).waitFor();
    if (await relinkButton.isVisible()) {
      debug('unlinked, clicking left pane button');
      await relinkButton.click();
      await qrCode.waitFor();
    }

    debug('waiting for provision');
    const provision = await this.server.waitForProvision();

    debug('waiting for provision URL');
    const provisionURL = await app.waitForProvisionURL();

    debug('completing provision');
    this.#privDesktop = await provision.complete({
      provisionURL,
      primaryDevice: this.phone,
    });

    if (ephemeralBackup != null) {
      await this.server.provideTransferArchive(this.desktop, ephemeralBackup);
    }

    debug('new desktop device %j', this.desktop.debugId);

    const desktopKey = await this.desktop.popSingleUseKey();
    await this.phone.addSingleUseKey(this.desktop, desktopKey);

    for (const contact of this.allContacts) {
      for (const serviceIdKind of [ServiceIdKind.ACI, ServiceIdKind.PNI]) {
        // eslint-disable-next-line no-await-in-loop
        const contactKey = await this.desktop.popSingleUseKey(serviceIdKind);
        // eslint-disable-next-line no-await-in-loop
        await contact.addSingleUseKey(this.desktop, contactKey, serviceIdKind);
      }
    }

    await this.phone.waitForSync(this.desktop);
    this.phone.resetSyncState(this.desktop);

    debug('synced with %j', this.desktop.debugId);

    return app;
  }

  public async linkAndClose(): Promise<void> {
    const app = await this.link();

    debug('closing the app after link');
    await app.close();
  }

  public async startApp(
    extraConfig?: Partial<RendererConfigType>
  ): Promise<App> {
    assert(
      this.#storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    debug('starting the app');

    const { port, family } = this.server.address();

    let startAttempts = 0;
    const MAX_ATTEMPTS = 4;
    let app: App | undefined;
    while (!app) {
      startAttempts += 1;
      if (startAttempts > MAX_ATTEMPTS) {
        throw new Error(
          `App failed to start after ${MAX_ATTEMPTS} times, giving up`
        );
      }

      // eslint-disable-next-line no-await-in-loop
      const config = await this.#generateConfig(port, family, extraConfig);

      const startedApp = new App({
        main: ELECTRON,
        args: [CI_SCRIPT],
        config,
      });

      try {
        // eslint-disable-next-line no-await-in-loop
        await startedApp.start();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `Failed to start the app, attempt ${startAttempts}, retrying`,
          error
        );

        // eslint-disable-next-line no-await-in-loop
        await this.#resetAppStorage();
        continue;
      }

      this.#lastApp = startedApp;
      startedApp.on('close', () => {
        if (this.#lastApp === startedApp) {
          this.#lastApp = undefined;
        }
      });

      app = startedApp;
    }

    return app;
  }

  public getTimestamp(): number {
    const result = this.#timestamp;
    this.#timestamp += 1;
    return result;
  }

  public async maybeSaveLogs(
    test?: Mocha.Runnable,
    app: App | undefined = this.#lastApp
  ): Promise<void> {
    const { FORCE_ARTIFACT_SAVE } = process.env;
    if (test?.state !== 'passed' || FORCE_ARTIFACT_SAVE) {
      await this.saveLogs(app, test?.fullTitle());
    }
  }

  public async saveLogs(
    app: App | undefined = this.#lastApp,
    testName?: string
  ): Promise<void> {
    const outDir = await this.#getArtifactsDir(testName);
    if (outDir == null) {
      return;
    }

    // eslint-disable-next-line no-console
    console.error(`Saving logs to ${outDir}`);

    const { logsDir } = this;
    await fs.rename(logsDir, path.join(outDir, 'logs'));

    const page = await app?.getWindow();
    if (process.env.TRACING) {
      await page
        ?.context()
        .tracing.stop({ path: path.join(outDir, 'trace.zip') });
    }
    if (app) {
      const window = await app.getWindow();
      const screenshot = await window.screenshot();
      await fs.writeFile(path.join(outDir, 'screenshot.png'), screenshot);
    }
  }

  public async createScreenshotComparator(
    app: App,
    callback: (
      page: Page,
      snapshot: (name: string) => Promise<void>
    ) => Promise<void>,
    test?: Mocha.Runnable
  ): Promise<(app: App) => Promise<void>> {
    const snapshots = new Array<{ name: string; data: Buffer }>();

    const window = await app.getWindow();
    await callback(window, async (name: string) => {
      debug('creating screenshot');
      snapshots.push({
        name,
        data: await window.screenshot(),
      });
    });

    let index = 0;

    return async (anotherApp: App): Promise<void> => {
      const anotherWindow = await anotherApp.getWindow();
      await callback(anotherWindow, async (name: string) => {
        index += 1;

        const before = snapshots.shift();
        assert(before != null, 'No previous snapshot');
        assert.strictEqual(before.name, name, 'Wrong snapshot order');

        const after = await anotherWindow.screenshot();

        const beforePng = PNG.sync.read(before.data);
        const afterPng = PNG.sync.read(after);

        const { width, height } = beforePng;
        const diffPng = new PNG({ width, height });

        const numPixels = pixelmatch(
          beforePng.data,
          afterPng.data,
          diffPng.data,
          width,
          height,
          {}
        );

        if (numPixels === 0 && !process.env.FORCE_ARTIFACT_SAVE) {
          debug('no screenshot difference');
          return;
        }

        debug(
          `screenshot difference for ${name}: ${numPixels}/${width * height}`
        );

        const outDir = await this.#getArtifactsDir(test?.fullTitle());
        if (outDir != null) {
          debug('saving screenshots and diff');
          const prefix = `${index}-${sanitizePathComponent(name)}`;
          await fs.writeFile(
            path.join(outDir, `${prefix}-before.png`),
            before.data
          );
          await fs.writeFile(path.join(outDir, `${prefix}-after.png`), after);
          await fs.writeFile(
            path.join(outDir, `${prefix}-diff.png`),
            PNG.sync.write(diffPng)
          );
        }

        assert.strictEqual(numPixels, 0, 'Expected no pixels to be different');
      });
    };
  }

  public getAbsoluteAttachmentPath(relativePath: string): string {
    strictAssert(this.#storagePath, 'storagePath must exist');
    return join(this.#storagePath, 'attachments.noindex', relativePath);
  }

  public async storeAttachmentOnCDN(
    data: Buffer,
    contentType: MIMEType
  ): Promise<Proto.IAttachmentPointer> {
    const cdnKey = uuid();
    const keys = generateAttachmentKeys();
    const cdnNumber = 3;

    const passthrough = new PassThrough();

    const [{ digest }] = await Promise.all([
      encryptAttachmentV2({
        keys,
        plaintext: {
          data,
        },
        needIncrementalMac: false,
        sink: passthrough,
      }),
      this.server.storeAttachmentOnCdn(cdnNumber, cdnKey, passthrough),
    ]);

    return {
      size: data.byteLength,
      contentType,
      cdnKey,
      cdnNumber,
      key: keys,
      digest,
    };
  }

  //
  // Getters
  //

  public get phone(): PrimaryDevice {
    assert(
      this.#privPhone,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.#privPhone;
  }

  public get desktop(): Device {
    assert(
      this.#privDesktop,
      'Bootstrap has to be linked first, see: bootstrap.link()'
    );
    return this.#privDesktop;
  }

  public get contacts(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.#privContacts,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.#privContacts;
  }

  public get contactsWithoutProfileKey(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.#privContactsWithoutProfileKey,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.#privContactsWithoutProfileKey;
  }
  public get unknownContacts(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.#privUnknownContacts,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.#privUnknownContacts;
  }

  public get allContacts(): ReadonlyArray<PrimaryDevice> {
    return [
      ...this.contacts,
      ...this.contactsWithoutProfileKey,
      ...this.unknownContacts,
    ];
  }

  //
  // Private
  //

  async #getArtifactsDir(testName?: string): Promise<string | undefined> {
    const { ARTIFACTS_DIR } = process.env;
    if (!ARTIFACTS_DIR) {
      // eslint-disable-next-line no-console
      console.error(
        'Not saving artifacts. Please set ARTIFACTS_DIR env variable'
      );
      return undefined;
    }

    const normalizedPath = testName
      ? `${this.#randomId}-${sanitizePathComponent(testName)}`
      : this.#randomId;

    const outDir = path.join(ARTIFACTS_DIR, normalizedPath);
    await fs.mkdir(outDir, { recursive: true });

    return outDir;
  }

  private static async runBenchmark<Result>(
    fn: (bootstrap: Bootstrap) => Promise<Result>,
    timeout: number
  ): Promise<Result> {
    const bootstrap = new Bootstrap({
      benchmark: true,
    });

    await bootstrap.init();

    let result: Result;
    try {
      result = await pTimeout(fn(bootstrap), timeout);
      if (process.env.FORCE_ARTIFACT_SAVE) {
        await bootstrap.saveLogs();
      }
    } catch (error) {
      await bootstrap.saveLogs();
      throw error;
    } finally {
      await bootstrap.teardown();
    }

    return result;
  }

  private static async runRegressionBenchmark(
    fn: (fnOptions: RegressionBenchmarkFnOptions) => Promise<RegressionSample>,
    {
      iterationCount = 10,
      maxCycles = 1,
      maxError = 0.025 /* 2.5% */,
      fromValue,
      toValue,
      timeout = 5 * MINUTE,
    }: RegressionBenchmarkOptions
  ): Promise<void> {
    if (iterationCount <= 1) {
      throw new Error('Not enough iterations');
    }

    const samples = new Array<{ value: number; data: RegressionSample }>();
    let lineNum = 0;
    for (let cycle = 0; cycle < maxCycles; cycle += 1) {
      for (let iteration = 0; iteration < iterationCount; iteration += 1) {
        const progress = (iteration % iterationCount) / (iterationCount - 1);
        const value = Math.round(
          fromValue * (1 - progress) + toValue * progress
        );

        // eslint-disable-next-line no-await-in-loop
        const data = await Bootstrap.runBenchmark(bootstrap => {
          return fn({ bootstrap, iteration, value });
        }, timeout);

        if (data.metrics) {
          // eslint-disable-next-line no-console
          console.log(`run=${lineNum} info=%j`, data.metrics);
          lineNum += 1;
        }

        samples.push({
          value,
          data,
        });

        // eslint-disable-next-line no-console
        console.log(
          'cycle=%d iteration=%d value=%d data=%j',
          cycle,
          iteration,
          value,
          data
        );
      }

      const result: Record<string, number> = Object.create(null);
      const keys = Object.keys(samples[0].data).filter(
        (key: string): key is `${string}Duration` => key.endsWith('Duration')
      );
      const human = new Array<string>();

      let worstError = 0;
      for (const key of keys) {
        const { yIntercept, slope, confidence, outliers, severeOutliers } =
          regress(samples.map(s => ({ y: s.value, x: s.data[key] })));

        const delay = -yIntercept / slope;
        const perSecond = slope * SECOND;
        const error = confidence * SECOND;

        const valueType = key.replace(/Duration$/, '');

        human.push(
          `cycle=${cycle} ${valueType}PerSecond=` +
            `${perSecond.toFixed(2)}±${error.toFixed(2)} ` +
            `outliers=${outliers + severeOutliers} delay=${delay.toFixed(2)}ms`
        );

        result[`${valueType}PerSec`] = perSecond;
        result[`${valueType}Delay`] = delay;
        result[`${valueType}Error`] = error;

        worstError = Math.max(worstError, error / perSecond);
      }

      // eslint-disable-next-line no-console
      console.log(human.join('\n'));

      if (cycle !== maxCycles - 1 && worstError > maxError) {
        // eslint-disable-next-line no-console
        console.warn(
          `cycle=${cycle} error=${worstError} max=${maxError} continuing`
        );
        continue;
      }

      // eslint-disable-next-line no-console
      console.log(`run=${lineNum} info=%j`, result);
      break;
    }
  }

  async #generateConfig(
    port: number,
    family: string,
    extraConfig?: Partial<RendererConfigType>
  ): Promise<string> {
    const host = family === 'IPv6' ? '[::1]' : '127.0.0.1';

    const url = `https://${host}:${port}`;
    return JSON.stringify({
      ...(await loadCertificates()),

      forcePreloadBundle: this.#options.benchmark,
      ciMode: 'full',

      buildExpiration: Date.now() + MONTH,
      storagePath: this.#storagePath,
      storageProfile: 'mock',
      serverUrl: url,
      storageUrl: `${url}/storageService`,
      resourcesUrl: `${url}/updates2`,
      sfuUrl: url,
      cdn: {
        '0': url,
        '2': url,
        '3': `${url}/cdn3`,
      },
      updatesEnabled: false,

      directoreType: 'cdsi',
      directoryCDSIUrl: url,
      directoryCDSIMRENCLAVE:
        '51133fecb3fa18aaf0c8f64cb763656d3272d9faaacdb26ae7df082e414fb142',

      ...extraConfig,
    });
  }
}
