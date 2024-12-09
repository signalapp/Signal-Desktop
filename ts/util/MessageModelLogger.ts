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
    get(_: MessageModel, property: keyof MessageModel) {
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
        return model.registerLocations;
      }

      // Disallowed set of methods & attributes

      if (typeof model[property] === 'function') {
        return model[property].bind(model);
      }

      if (typeof model[property] !== 'undefined') {
        return model[property];
      }

      return undefined;
    },
  };

  return new Proxy(model, proxyHandler);
}
