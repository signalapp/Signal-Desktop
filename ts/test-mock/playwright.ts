// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ElectronApplication, Page } from 'playwright';
import { _electron as electron } from 'playwright';

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

export type AppOptionsType = Readonly<{
  main: string;
  args: ReadonlyArray<string>;
  config: string;
}>;

export class App {
  private privApp: ElectronApplication | undefined;

  constructor(private readonly options: AppOptionsType) {}

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

  public async close(): Promise<void> {
    await this.app.close();
  }

  public async getWindow(): Promise<Page> {
    return this.app.firstWindow();
  }

  private async waitForEvent<T>(event: string): Promise<T> {
    const window = await this.getWindow();

    const result = await window.evaluate(
      `window.CI.waitForEvent(${JSON.stringify(event)})`
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
