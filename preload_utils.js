// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */

const { ipcRenderer: ipc } = require('electron');

exports.installGetter = function installGetter(name, functionName) {
  ipc.on(`get-${name}`, async () => {
    const getFn = window.Events[functionName];
    if (!getFn) {
      ipc.send(
        `get-success-${name}`,
        `installGetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      ipc.send(`get-success-${name}`, null, await getFn());
    } catch (error) {
      ipc.send(
        `get-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
};

exports.installSetter = function installSetter(name, functionName) {
  ipc.on(`set-${name}`, async (_event, value) => {
    const setFn = window.Events[functionName];
    if (!setFn) {
      ipc.send(
        `set-success-${name}`,
        `installSetter: ${functionName} not found for event ${name}`
      );
      return;
    }
    try {
      await setFn(value);
      ipc.send(`set-success-${name}`);
    } catch (error) {
      ipc.send(
        `set-success-${name}`,
        error && error.stack ? error.stack : error
      );
    }
  });
};

exports.makeGetter = function makeGetter(name) {
  return () =>
    new Promise((resolve, reject) => {
      ipc.once(`get-success-${name}`, (event, error, value) => {
        if (error) {
          return reject(error);
        }

        return resolve(value);
      });
      ipc.send(`get-${name}`);
    });
};

exports.makeSetter = function makeSetter(name) {
  return value =>
    new Promise((resolve, reject) => {
      ipc.once(`set-success-${name}`, (event, error) => {
        if (error) {
          return reject(error);
        }

        return resolve();
      });
      ipc.send(`set-${name}`, value);
    });
};
