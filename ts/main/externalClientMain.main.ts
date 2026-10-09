// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { app, dialog, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainEvent } from 'electron';
import { userInfo } from 'node:os';

import { createLogger } from '../logging/log.std.ts';
import * as Errors from '../types/errors.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { MainSQL } from '../sql/main.main.ts';
import { drop } from '../util/drop.std.ts';
import { safeParseUnknown } from '../util/schemas.std.ts';
import { _isFeatureEnabledInner } from '../util/isFeatureEnabledInner.std.ts';
import type { ConfigMapType } from '../RemoteConfig.dom.ts';
import { getExternalClientEndpoint } from '../externalClient/endpoint.node.ts';
import { ExternalClientAuthority } from '../externalClient/ExternalClientAuthority.node.ts';
import type { ApprovalPromptType } from '../externalClient/ExternalClientAuthority.node.ts';
import { ExternalClientServer } from '../externalClient/ExternalClientServer.node.ts';
import type {
  ApprovalRequestType,
  ExternalClientHostType,
  ServiceResultType,
} from '../externalClient/hostTypes.std.ts';
import type {
  CapabilityType,
  EventTopicType,
  ServiceMethodType,
  SessionStatusType,
} from '../externalClient/protocol.std.ts';
import {
  Capability,
  ErrorCode,
  SessionStatus,
} from '../externalClient/protocol.std.ts';
import type {
  ExternalClientAppType,
  RendererTopicsType,
} from '../externalClient/rendererChannel.std.ts';
import {
  CALL_CHANNEL,
  EVENTS_CHANNEL,
  EVENTS_READY_CHANNEL,
  LIST_APPS_CHANNEL,
  REFRESH_CHANNEL,
  REMOVE_APP_CHANNEL,
  removeAppSchema,
  RESULT_CHANNEL,
  TOPICS_CHANNEL,
  rendererEventsSchema,
  rendererResultSchema,
} from '../externalClient/rendererChannel.std.ts';

const log = createLogger('externalClientMain');

const RENDERER_CALL_TIMEOUT_MS = 15_000;
const MAX_PENDING_RENDERER_CALLS = 64;

export type ExternalClientMainOptionsType = Readonly<{
  sql: MainSQL;
  userDataPath: string;
  getMainWindow: () => BrowserWindow | undefined;
  getIsLinked: () => Promise<boolean>;
  getI18n: () => LocalizerType;
}>;

// Owns the lifecycle of the local external-client bridge. The bridge is off
// unless the user enabled it; when off there is no listener and no endpoint
// on disk. See docs/external-client-architecture.md.
export class ExternalClientMain {
  readonly #options: ExternalClientMainOptionsType;
  readonly #authority: ExternalClientAuthority;
  readonly #pending = new Map<
    number,
    { resolve: (result: ServiceResultType) => void; timer: NodeJS.Timeout }
  >();
  #nextSeq = 0;
  #server: ExternalClientServer | undefined;

  constructor(options: ExternalClientMainOptionsType) {
    this.#options = options;
    const { sql } = options;
    this.#authority = new ExternalClientAuthority({
      storage: {
        readGrants: async () =>
          (await sql.sqlRead('getItemById', 'externalClientGrants'))?.value,
        writeGrants: async grants => {
          await sql.sqlWrite('createOrUpdateItem', {
            id: 'externalClientGrants',
            value: grants,
          });
        },
        readServerKey: async () =>
          (await sql.sqlRead('getItemById', 'externalClientServerKey'))?.value,
        writeServerKey: async key => {
          await sql.sqlWrite('createOrUpdateItem', {
            id: 'externalClientServerKey',
            value: key,
          });
        },
      },
      prompt: this.#prompt,
    });

    ipcMain.on(RESULT_CHANNEL, (event, message) =>
      this.#onRendererResult(event, message)
    );
    ipcMain.on(EVENTS_CHANNEL, (event, message) =>
      this.#onRendererEvents(event, message)
    );
    ipcMain.handle(LIST_APPS_CHANNEL, async event => {
      if (!this.#isMainRenderer(event)) {
        return [];
      }
      const grants = await this.#authority.listGrants();
      return grants.map(
        (grant): ExternalClientAppType => ({
          id: grant.fingerprint,
          displayName: grant.displayName,
          capabilities: grant.capabilities,
          approvedAt: grant.approvedAt,
          lastSeenAt: grant.lastSeenAt,
        })
      );
    });
    ipcMain.handle(REMOVE_APP_CHANNEL, async (event, id: unknown) => {
      const parsed = safeParseUnknown(removeAppSchema, id);
      if (!this.#isMainRenderer(event) || !parsed.success) {
        return;
      }
      const grants = await this.#authority.listGrants();
      const grant = grants.find(item => item.fingerprint === parsed.data);
      if (grant) {
        await this.revoke(grant.publicKey);
      }
    });
    ipcMain.on(REFRESH_CHANNEL, event => {
      if (this.#isMainRenderer(event)) {
        drop(this.refresh());
      }
    });
    // The renderer (re)loaded. Anything it had queued is gone, so current
    // subscribers must resynchronize; that also resets its topics.
    ipcMain.on(EVENTS_READY_CHANNEL, event => {
      if (!this.#isMainRenderer(event)) {
        return;
      }
      this.#server?.dropEvents();
      this.#sendTopics();
    });
  }

  // Must be called only after SQL initialized successfully. The enabled flag
  // lives in the encrypted database rather than a plaintext config file so
  // that another process cannot switch the bridge on by editing a file.
  async refresh(): Promise<void> {
    let enabled: boolean;
    try {
      enabled = await this.#isEnabled();
    } catch (error) {
      log.error('refresh: failed to read setting', Errors.toLogFormat(error));
      enabled = false;
    }

    if (enabled) {
      await this.#start();
    } else {
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    if (!server) {
      return;
    }
    try {
      await server.stop();
    } catch (error) {
      log.error('stop: failed', Errors.toLogFormat(error));
    }
    this.#sendTopics();
  }

  // Deletes the grant and drops any live session using it.
  async revoke(publicKey: string): Promise<void> {
    const removed = await this.#authority.revoke(publicKey);
    const closed = this.#server?.revoke(publicKey) ?? 0;
    log.info(`revoke: removed=${removed} closedSessions=${closed}`);
  }

  async #isEnabled(): Promise<boolean> {
    // Unpackaged development builds can opt in without touching the database.
    if (!app.isPackaged && process.env.SIGNAL_ENABLE_EXTERNAL_CLIENTS === '1') {
      return true;
    }
    // Both Signal (remote config) and the user must have turned it on.
    if (!(await this.#isAllowedByRemoteConfig())) {
      return false;
    }
    const item = await this.#options.sql.sqlRead(
      'getItemById',
      'externalClientsEnabled'
    );
    return item?.value === true;
  }

  async #isAllowedByRemoteConfig(): Promise<boolean> {
    const item = await this.#options.sql.sqlRead('getItemById', 'remoteConfig');
    const remoteConfig: ConfigMapType | undefined = item?.value;
    return _isFeatureEnabledInner({
      betaValue: remoteConfig?.['desktop.externalClients.beta']?.value,
      currentVersion: app.getVersion(),
      isInternalUser: remoteConfig?.['desktop.internalUser']?.enabled ?? false,
      prodValue: remoteConfig?.['desktop.externalClients.prod']?.value,
    });
  }

  async #start(): Promise<void> {
    if (this.#server) {
      return;
    }

    const endpoint = getExternalClientEndpoint({
      platform: process.platform,
      userDataPath: this.#options.userDataPath,
      username: userInfo().username,
      runtimeDir: process.env.XDG_RUNTIME_DIR,
    });
    const server = new ExternalClientServer({
      endpoint,
      getSignalVersion: () => app.getVersion(),
      log,
      authority: this.#authority,
      host: this.#host,
      onTopicsChanged: () => this.#sendTopics(),
      onNotificationsHandledChanged: () => this.#sendTopics(),
    });

    try {
      await server.start();
      this.#server = server;
      // Endpoint names are a hash, not user data; paths under userData are
      // redacted by the logger anyway.
      log.info(`start: listening on ${endpoint.kind} ${endpoint.path}`);
    } catch (error) {
      // Fail closed: an occupied or unsafe endpoint means no bridge, not a
      // retry loop or a fallback location.
      log.error('start: bridge not started', Errors.toLogFormat(error));
    }
  }

  readonly #host: ExternalClientHostType = {
    getStatus: async (): Promise<SessionStatusType> => {
      if (!(await this.#options.getIsLinked())) {
        return SessionStatus.Unlinked;
      }
      return this.#options.getMainWindow()
        ? SessionStatus.Ready
        : SessionStatus.Starting;
    },
    callService: async (method, params) => {
      if (!(await this.#options.getIsLinked())) {
        return { ok: false, code: ErrorCode.NotReady };
      }
      return this.#callRenderer(method, params);
    },
  };

  #callRenderer(
    method: ServiceMethodType,
    params: unknown
  ): Promise<ServiceResultType> {
    const webContents = this.#options.getMainWindow()?.webContents;
    if (!webContents || webContents.isDestroyed()) {
      return Promise.resolve({ ok: false, code: ErrorCode.NotReady });
    }
    if (this.#pending.size >= MAX_PENDING_RENDERER_CALLS) {
      return Promise.resolve({ ok: false, code: ErrorCode.RateLimited });
    }

    const seq = this.#nextSeq;
    this.#nextSeq += 1;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.#pending.delete(seq);
        log.warn(`renderer call ${method} timed out`);
        resolve({ ok: false, code: ErrorCode.NotReady });
      }, RENDERER_CALL_TIMEOUT_MS);
      this.#pending.set(seq, { resolve, timer });
      webContents.send(CALL_CHANNEL, { seq, method, params });
    });
  }

  #isMainRenderer(event: Pick<IpcMainEvent, 'sender'>): boolean {
    const mainWebContents = this.#options.getMainWindow()?.webContents;
    return mainWebContents !== undefined && event.sender === mainWebContents;
  }

  // Tells the renderer which event topics any client wants right now.
  #sendTopics(): void {
    const webContents = this.#options.getMainWindow()?.webContents;
    if (!webContents || webContents.isDestroyed()) {
      return;
    }
    const topics: ReadonlyArray<EventTopicType> = this.#server?.topics ?? [];
    webContents.send(TOPICS_CHANNEL, {
      topics: [...topics],
      notificationsHandled: this.#server?.notificationsHandled ?? false,
    } satisfies RendererTopicsType);
  }

  #onRendererEvents(event: IpcMainEvent, message: unknown): void {
    if (!this.#isMainRenderer(event)) {
      log.warn('ignoring events from unexpected sender');
      return;
    }
    const server = this.#server;
    if (!server) {
      return;
    }
    const parsed = safeParseUnknown(rendererEventsSchema, message);
    if (!parsed.success) {
      log.warn('ignoring malformed renderer events');
      return;
    }
    if (parsed.data.overflow) {
      server.dropEvents();
    }
    for (const { event: name, data } of parsed.data.events) {
      server.broadcast(name, data);
    }
  }

  #onRendererResult(event: IpcMainEvent, message: unknown): void {
    // Only the main window's renderer may answer.
    if (!this.#isMainRenderer(event)) {
      log.warn('ignoring result from unexpected sender');
      return;
    }
    const parsed = safeParseUnknown(rendererResultSchema, message);
    if (!parsed.success) {
      log.warn('ignoring malformed renderer result');
      return;
    }
    const pending = this.#pending.get(parsed.data.seq);
    if (!pending) {
      return;
    }
    this.#pending.delete(parsed.data.seq);
    clearTimeout(pending.timer);
    pending.resolve(
      parsed.data.ok
        ? { ok: true, value: parsed.data.value }
        : { ok: false, code: parsed.data.code }
    );
  }

  // A native modal dialog owned by Signal. The client supplies only the
  // text shown in it and has no way to answer it.
  readonly #prompt: ApprovalPromptType = async (
    request: ApprovalRequestType
  ): Promise<ReadonlyArray<CapabilityType> | undefined> => {
    const mainWindow = this.#options.getMainWindow();
    if (!mainWindow) {
      return undefined;
    }
    const i18n = this.#options.getI18n();
    mainWindow.show();

    const capabilityLines = request.capabilities
      .map(capability => `• ${getCapabilityLabel(i18n, capability)}`)
      .join('\n');
    const allow = i18n('icu:ExternalClientApproval__allow');
    const deny = i18n('icu:ExternalClientApproval__deny');
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: i18n('icu:ExternalClientApproval__title'),
      message: i18n('icu:ExternalClientApproval__message', {
        name: request.displayName,
      }),
      detail: i18n('icu:ExternalClientApproval__detail', {
        fingerprint: request.fingerprint,
        capabilities: capabilityLines,
      }),
      buttons: [deny, allow],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return response === 1 ? request.capabilities : undefined;
  };
}

function getCapabilityLabel(
  i18n: LocalizerType,
  capability: CapabilityType
): string {
  switch (capability) {
    case Capability.ConversationsRead:
      return i18n('icu:ExternalClientCapability__conversations-read');
    case Capability.MessagesRead:
      return i18n('icu:ExternalClientCapability__messages-read');
    case Capability.MessagesSend:
      return i18n('icu:ExternalClientCapability__messages-send');
    case Capability.MessagesMarkRead:
      return i18n('icu:ExternalClientCapability__messages-mark-read');
    case Capability.NotificationsManage:
      return i18n('icu:ExternalClientCapability__notifications-manage');
    default:
      // Only implemented capabilities can be requested; see protocol.std.ts.
      return capability;
  }
}
