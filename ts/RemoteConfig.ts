import { get, throttle } from 'lodash';
import { WebAPIType } from './textsecure/WebAPI';

type ConfigKeyType = 'desktop.messageRequests';
type ConfigValueType = {
  name: ConfigKeyType;
  enabled: boolean;
  enabledAt?: number;
};
type ConfigMapType = { [key: string]: ConfigValueType };
type ConfigListenerType = (value: ConfigValueType) => unknown;
type ConfigListenersMapType = {
  [key: string]: Array<ConfigListenerType>;
};

function getServer(): WebAPIType {
  const OLD_USERNAME = window.storage.get<string>('number_id');
  const USERNAME = window.storage.get<string>('uuid_id');
  const PASSWORD = window.storage.get<string>('password');

  return window.WebAPI.connect({
    username: (USERNAME || OLD_USERNAME) as string,
    password: PASSWORD as string,
  });
}

let config: ConfigMapType = {};
const listeners: ConfigListenersMapType = {};

export async function initRemoteConfig() {
  config = window.storage.get('remoteConfig') || {};
  await maybeRefreshRemoteConfig();
}

export function onChange(key: ConfigKeyType, fn: ConfigListenerType) {
  const keyListeners: Array<ConfigListenerType> = get(listeners, key, []);
  keyListeners.push(fn);
  listeners[key] = keyListeners;

  return () => {
    listeners[key] = listeners[key].filter(l => l !== fn);
  };
}

export const refreshRemoteConfig = async () => {
  const now = Date.now();
  const server = getServer();
  const newConfig = await server.getConfig();

  // Process new configuration in light of the old configuration
  // The old configuration is not set as the initial value in reduce because
  // flags may have been deleted
  const oldConfig = config;
  config = newConfig.reduce((previous, { name, enabled }) => {
    const previouslyEnabled: boolean = get(oldConfig, [name, 'enabled'], false);
    // If a flag was previously not enabled and is now enabled, record the time it was enabled
    const enabledAt: number | undefined =
      previouslyEnabled && enabled ? now : get(oldConfig, [name, 'enabledAt']);

    const value = {
      name: name as ConfigKeyType,
      enabled,
      enabledAt,
    };

    // If enablement changes at all, notify listeners
    const currentListeners = listeners[name] || [];
    if (previouslyEnabled !== enabled) {
      currentListeners.forEach(listener => {
        listener(value);
      });
    }

    // Return new configuration object
    return {
      ...previous,
      [name]: value,
    };
  }, {});

  window.storage.put('remoteConfig', config);
};

export const maybeRefreshRemoteConfig = throttle(
  refreshRemoteConfig,
  // Only fetch remote configuration if the last fetch was more than two hours ago
  2 * 60 * 60 * 1000,
  { trailing: false }
);

export function isEnabled(name: ConfigKeyType): boolean {
  return get(config, [name, 'enabled'], false);
}
