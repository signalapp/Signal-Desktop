// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import createDebug from 'debug';
import pTimeout from 'p-timeout';
import normalizePath from 'normalize-path';

import type { Device, PrimaryDevice } from '@signalapp/mock-server';
import {
  Server,
  ServiceIdKind,
  loadCertificates,
} from '@signalapp/mock-server';
import { MAX_READ_KEYS as MAX_STORAGE_READ_KEYS } from '../services/storageConstants';
import * as durations from '../util/durations';
import { drop } from '../util/drop';
import { App } from './playwright';
import { CONTACT_COUNT } from './benchmarks/fixtures';

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
  extraConfig?: Record<string, unknown>;
  benchmark?: boolean;

  linkedDevices?: number;
  contactCount?: number;
  contactsWithoutProfileKey?: number;
  unknownContactCount?: number;
  contactNames?: ReadonlyArray<string>;
  contactPreKeyCount?: number;
}>;

type BootstrapInternalOptions = Pick<BootstrapOptions, 'extraConfig'> &
  Readonly<{
    benchmark: boolean;
    linkedDevices: number;
    contactCount: number;
    contactsWithoutProfileKey: number;
    unknownContactCount: number;
    contactNames: ReadonlyArray<string>;
  }>;

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

  private readonly options: BootstrapInternalOptions;
  private privContacts?: ReadonlyArray<PrimaryDevice>;
  private privContactsWithoutProfileKey?: ReadonlyArray<PrimaryDevice>;
  private privUnknownContacts?: ReadonlyArray<PrimaryDevice>;
  private privPhone?: PrimaryDevice;
  private privDesktop?: Device;
  private storagePath?: string;
  private timestamp: number = Date.now() - durations.WEEK;
  private lastApp?: App;

  constructor(options: BootstrapOptions = {}) {
    this.server = new Server({
      // Limit number of storage read keys for easier testing
      maxStorageReadKeys: MAX_STORAGE_READ_KEYS,
    });

    this.options = {
      linkedDevices: 5,
      contactCount: CONTACT_COUNT,
      contactsWithoutProfileKey: 0,
      unknownContactCount: 0,
      contactNames: CONTACT_NAMES,
      benchmark: false,

      ...options,
    };

    const totalContactCount =
      this.options.contactCount +
      this.options.contactsWithoutProfileKey +
      this.options.unknownContactCount;
    assert(totalContactCount <= this.options.contactNames.length);
    assert(totalContactCount <= MAX_CONTACTS);
  }

  public async init(): Promise<void> {
    debug('initializing');

    await this.server.listen(0);

    const { port } = this.server.address();
    debug('started server on port=%d', port);

    const totalContactCount =
      this.options.contactCount +
      this.options.contactsWithoutProfileKey +
      this.options.unknownContactCount;

    const allContacts = await Promise.all(
      this.options.contactNames
        .slice(0, totalContactCount)
        .map(async profileName => {
          const primary = await this.server.createPrimaryDevice({
            profileName,
          });

          for (let i = 0; i < this.options.linkedDevices; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await this.server.createSecondaryDevice(primary);
          }

          return primary;
        })
    );

    this.privContacts = allContacts.splice(0, this.options.contactCount);
    this.privContactsWithoutProfileKey = allContacts.splice(
      0,
      this.options.contactsWithoutProfileKey
    );
    this.privUnknownContacts = allContacts.splice(
      0,
      this.options.unknownContactCount
    );

    this.privPhone = await this.server.createPrimaryDevice({
      profileName: 'Myself',
      contacts: this.contacts,
      contactsWithoutProfileKey: this.contactsWithoutProfileKey,
    });

    this.storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'mock-signal-'));

    debug('setting storage path=%j', this.storagePath);
  }

  public static benchmark(
    fn: (bootstrap: Bootstrap) => Promise<void>,
    timeout = 5 * durations.MINUTE
  ): void {
    drop(Bootstrap.runBenchmark(fn, timeout));
  }

  public get logsDir(): string {
    assert(
      this.storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    return path.join(this.storagePath, 'logs');
  }

  public async teardown(): Promise<void> {
    debug('tearing down');

    await Promise.race([
      Promise.all([
        this.storagePath
          ? fs.rm(this.storagePath, { recursive: true })
          : Promise.resolve(),
        this.server.close(),
        this.lastApp?.close(),
      ]),
      new Promise(resolve => setTimeout(resolve, CLOSE_TIMEOUT).unref()),
    ]);
  }

  public async link(): Promise<App> {
    debug('linking');

    const app = await this.startApp();

    const provision = await this.server.waitForProvision();

    const provisionURL = await app.waitForProvisionURL();

    this.privDesktop = await provision.complete({
      provisionURL,
      primaryDevice: this.phone,
    });

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

  public async startApp(): Promise<App> {
    assert(
      this.storagePath !== undefined,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );

    debug('starting the app');

    const { port } = this.server.address();
    const config = await this.generateConfig(port);

    let startAttempts = 0;
    const MAX_ATTEMPTS = 5;
    let app: App | undefined;
    while (!app) {
      startAttempts += 1;
      if (startAttempts > MAX_ATTEMPTS) {
        throw new Error(
          `App failed to start after ${MAX_ATTEMPTS} times, giving up`
        );
      }
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
        continue;
      }

      this.lastApp = startedApp;
      startedApp.on('close', () => {
        if (this.lastApp === startedApp) {
          this.lastApp = undefined;
        }
      });

      app = startedApp;
    }

    return app;
  }

  public getTimestamp(): number {
    const result = this.timestamp;
    this.timestamp += 1;
    return result;
  }

  public async maybeSaveLogs(
    test?: Mocha.Test,
    app: App | undefined = this.lastApp
  ): Promise<void> {
    const { FORCE_ARTIFACT_SAVE } = process.env;
    if (test?.state !== 'passed' || FORCE_ARTIFACT_SAVE) {
      await this.saveLogs(app, test?.fullTitle());
    }
  }

  public async saveLogs(
    app: App | undefined = this.lastApp,
    pathPrefix?: string
  ): Promise<void> {
    const { ARTIFACTS_DIR } = process.env;
    if (!ARTIFACTS_DIR) {
      // eslint-disable-next-line no-console
      console.error('Not saving logs. Please set ARTIFACTS_DIR env variable');
      return;
    }

    await fs.mkdir(ARTIFACTS_DIR, { recursive: true });

    const normalizedPrefix = pathPrefix
      ? `-${normalizePath(pathPrefix.replace(/[^a-z]+/gi, '-'))}-`
      : '';
    const outDir = await fs.mkdtemp(
      path.join(ARTIFACTS_DIR, `logs-${normalizedPrefix}`)
    );

    // eslint-disable-next-line no-console
    console.error(`Saving logs to ${outDir}`);

    const { logsDir } = this;
    await fs.rename(logsDir, outDir);

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

  //
  // Getters
  //

  public get phone(): PrimaryDevice {
    assert(
      this.privPhone,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.privPhone;
  }

  public get desktop(): Device {
    assert(
      this.privDesktop,
      'Bootstrap has to be linked first, see: bootstrap.link()'
    );
    return this.privDesktop;
  }

  public get contacts(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.privContacts,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.privContacts;
  }

  public get contactsWithoutProfileKey(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.privContactsWithoutProfileKey,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.privContactsWithoutProfileKey;
  }
  public get unknownContacts(): ReadonlyArray<PrimaryDevice> {
    assert(
      this.privUnknownContacts,
      'Bootstrap has to be initialized first, see: bootstrap.init()'
    );
    return this.privUnknownContacts;
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

  private static async runBenchmark(
    fn: (bootstrap: Bootstrap) => Promise<void>,
    timeout: number
  ): Promise<void> {
    const bootstrap = new Bootstrap({
      benchmark: true,
    });

    await bootstrap.init();

    try {
      await pTimeout(fn(bootstrap), timeout);
      if (process.env.FORCE_ARTIFACT_SAVE) {
        await bootstrap.saveLogs();
      }
    } catch (error) {
      await bootstrap.saveLogs();
      throw error;
    } finally {
      await bootstrap.teardown();
    }
  }

  private async generateConfig(port: number): Promise<string> {
    const url = `https://127.0.0.1:${port}`;
    return JSON.stringify({
      ...(await loadCertificates()),

      forcePreloadBundle: this.options.benchmark,
      ciMode: 'full',

      buildExpiration: Date.now() + durations.MONTH,
      storagePath: this.storagePath,
      storageProfile: 'mock',
      serverUrl: url,
      storageUrl: url,
      cdn: {
        '0': url,
        '2': url,
      },
      updatesEnabled: false,

      directoreType: 'cdsi',
      directoryCDSIUrl: url,
      directoryCDSIMRENCLAVE:
        '51133fecb3fa18aaf0c8f64cb763656d3272d9faaacdb26ae7df082e414fb142',

      ...this.options.extraConfig,
    });
  }
}
