// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ElectronApplication, Locator, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import { EventEmitter } from 'events';

import type {
  IPCRequest as ChallengeRequestType,
  IPCResponse as ChallengeResponseType,
} from '../challenge';
import type { ReceiptType } from '../types/Receipt';

export type AppLoadedInfoType = Readonly<{
  loadTime: number;
  messagesPerSec: number;
}>;

export type MessageSendInfoType = Readonly<{
  timestamp: number;
  delta: number;
}>;

export type ConversationOpenInfoType = Readonly<{
  delta: number;
}>;

export type ReceiptsInfoType = Readonly<{
  type: ReceiptType;
  timestamps: Array<number>;
}>;

export type StorageServiceInfoType = Readonly<{
  manifestVersion: number;
}>;

export type AppOptionsType = Readonly<{
  main: string;
  args: ReadonlyArray<string>;
  config: string;
}>;

export class App extends EventEmitter {
  private privApp: ElectronApplication | undefined;

  constructor(private readonly options: AppOptionsType) {
    super();
  }

  public async start(): Promise<void> {
    this.privApp = await electron.launch({
      executablePath: this.options.main,
      args: this.options.args.slice(),
      env: {
        ...process.env,
        SIGNAL_CI_CONFIG: this.options.config,
      },
      locale: 'en',
    });

    this.privApp.on('close', () => this.emit('close'));
  }

  public async waitForEnabledComposer(): Promise<Locator> {
    const window = await this.getWindow();
    const composeArea = window.locator(
      '.composition-area-wrapper, .conversation .ConversationView'
    );
    const composeContainer = composeArea.locator(
      '[data-testid=CompositionInput][data-enabled=true]'
    );
    await composeContainer.waitFor();

    return composeContainer.locator('.ql-editor');
  }

  public async waitForProvisionURL(): Promise<string> {
    return this.waitForEvent('provisioning-url');
  }

  public async waitUntilLoaded(): Promise<AppLoadedInfoType> {
    return this.waitForEvent('app-loaded');
  }

  public async waitForMessageSend(): Promise<MessageSendInfoType> {
    return this.waitForEvent('message:send-complete');
  }

  public async waitForConversationOpen(): Promise<ConversationOpenInfoType> {
    return this.waitForEvent('conversation:open');
  }

  public async waitForChallenge(): Promise<ChallengeRequestType> {
    return this.waitForEvent('challenge');
  }

  public async waitForReceipts(): Promise<ReceiptsInfoType> {
    return this.waitForEvent('receipts');
  }

  public async waitForStorageService(): Promise<StorageServiceInfoType> {
    return this.waitForEvent('storageServiceComplete');
  }

  public async waitForManifestVersion(version: number): Promise<void> {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const { manifestVersion } = await this.waitForStorageService();
      if (manifestVersion >= version) {
        break;
      }
    }
  }

  public async solveChallenge(response: ChallengeResponseType): Promise<void> {
    const window = await this.getWindow();

    await window.evaluate(
      `window.SignalCI.solveChallenge(${JSON.stringify(response)})`
    );
  }

  public async close(): Promise<void> {
    await this.app.close();
  }

  public async getWindow(): Promise<Page> {
    return this.app.firstWindow();
  }

  // EventEmitter types

  public override on(type: 'close', callback: () => void): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(type: 'close'): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }

  //
  // Private
  //

  private async waitForEvent<T>(event: string): Promise<T> {
    const window = await this.getWindow();

    const result = await window.evaluate(
      `window.SignalCI.waitForEvent(${JSON.stringify(event)})`
    );

    return result as T;
  }

  private get app(): ElectronApplication {
    if (!this.privApp) {
      throw new Error('Call ElectronWrap.start() first');
    }

    return this.privApp;
  }
}
