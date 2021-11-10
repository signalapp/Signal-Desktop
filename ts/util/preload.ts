// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { strictAssert } from './assert';
import type { UnwrapPromise } from '../types/Util';
import type {
  IPCEventsValuesType,
  IPCEventsCallbacksType,
  IPCEventGetterType,
  IPCEventSetterType,
} from './createIPCEvents';

type SettingOptionsType = {
  getter?: boolean;
  setter?: boolean;
};

export type SettingType<Value> = Readonly<{
  getValue: () => Promise<Value>;
  setValue: (value: Value) => Promise<Value>;
}>;

function capitalize<Name extends keyof IPCEventsValuesType>(
  name: Name
): Capitalize<Name> {
  const result = name.slice(0, 1).toUpperCase() + name.slice(1);

  return result as Capitalize<Name>;
}

function getSetterName<Key extends keyof IPCEventsValuesType>(
  name: Key
): IPCEventSetterType<Key> {
  return `set${capitalize(name)}`;
}

function getGetterName<Key extends keyof IPCEventsValuesType>(
  name: Key
): IPCEventGetterType<Key> {
  return `get${capitalize(name)}`;
}

export function createSetting<
  Name extends keyof IPCEventsValuesType,
  Value extends IPCEventsValuesType[Name]
>(name: Name, overrideOptions: SettingOptionsType = {}): SettingType<Value> {
  const options = {
    getter: true,
    setter: true,
    ...overrideOptions,
  };

  function getValue(): Promise<Value> {
    strictAssert(options.getter, `${name} has no getter`);
    return ipcRenderer.invoke(`settings:get:${name}`);
  }

  function setValue(value: Value): Promise<Value> {
    strictAssert(options.setter, `${name} has no setter`);
    return ipcRenderer.invoke(`settings:set:${name}`, value);
  }

  return {
    getValue,
    setValue,
  };
}

type UnwrapReturn<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Callback extends (...args: Array<any>) => unknown
> = UnwrapPromise<ReturnType<Callback>>;

export function createCallback<
  Name extends keyof IPCEventsCallbacksType,
  Callback extends IPCEventsCallbacksType[Name]
>(
  name: Name
): (...args: Parameters<Callback>) => Promise<UnwrapReturn<Callback>> {
  return (...args: Parameters<Callback>): Promise<UnwrapReturn<Callback>> => {
    return ipcRenderer.invoke(`settings:call:${name}`, args);
  };
}

export function installSetting(
  name: keyof IPCEventsValuesType,
  { getter = true, setter = true }: { getter?: boolean; setter?: boolean } = {}
): void {
  const getterName = getGetterName(name);
  const setterName = getSetterName(name);

  if (getter) {
    ipcRenderer.on(`settings:get:${name}`, async (_event, { seq }) => {
      const getFn = window.Events[getterName];
      if (!getFn) {
        ipcRenderer.send(
          `settings:get:${name}`,
          `installGetter: ${getterName} not found for event ${name}`
        );
        return;
      }
      try {
        ipcRenderer.send('settings:response', seq, null, await getFn());
      } catch (error) {
        ipcRenderer.send(
          'settings:response',
          seq,
          error && error.stack ? error.stack : error
        );
      }
    });
  }

  if (setter) {
    ipcRenderer.on(`settings:set:${name}`, async (_event, { seq, value }) => {
      // Some settings do not have setters...
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setFn = (window.Events as any)[setterName] as (
        value: unknown
      ) => Promise<void>;
      if (!setFn) {
        ipcRenderer.send(
          'settings:response',
          seq,
          `installSetter: ${setterName} not found for event ${name}`
        );
        return;
      }
      try {
        await setFn(value);
        ipcRenderer.send('settings:response', seq, null);
      } catch (error) {
        ipcRenderer.send(
          'settings:response',
          seq,
          error && error.stack ? error.stack : error
        );
      }
    });
  }
}

export function installCallback<Name extends keyof IPCEventsCallbacksType>(
  name: Name
): void {
  ipcRenderer.on(`settings:call:${name}`, async (_, { seq, args }) => {
    const hook = window.Events[name] as (
      ...hookArgs: Array<unknown>
    ) => Promise<unknown>;
    try {
      ipcRenderer.send('settings:response', seq, null, await hook(...args));
    } catch (error) {
      ipcRenderer.send(
        'settings:response',
        seq,
        error && error.stack ? error.stack : error
      );
    }
  });
}
