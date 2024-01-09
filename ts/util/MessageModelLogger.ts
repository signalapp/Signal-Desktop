// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageModel } from '../models/messages';
import { getEnvironment, Environment } from '../environment';

export function getMessageModelLogger(model: MessageModel): MessageModel {
  const { id } = model;

  if (getEnvironment() !== Environment.Development) {
    return model;
  }

  const proxyHandler: ProxyHandler<MessageModel> = {
    get(target: MessageModel, property: keyof MessageModel) {
      // Allowed set of attributes & methods
      if (property === 'attributes') {
        return model.attributes;
      }

      if (property === 'id') {
        return id;
      }

      if (property === 'get') {
        return model.get.bind(model);
      }

      if (property === 'set') {
        return model.set.bind(model);
      }

      if (property === 'registerLocations') {
        return target.registerLocations;
      }

      // Disallowed set of methods & attributes

      if (typeof target[property] === 'function') {
        return target[property].bind(target);
      }

      if (typeof target[property] !== 'undefined') {
        return target[property];
      }

      return undefined;
    },
  };

  return new Proxy(model, proxyHandler);
}
