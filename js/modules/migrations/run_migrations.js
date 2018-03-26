/* eslint-env browser */

const isFunction = require('lodash/isFunction');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');

const { deferredToPromise } = require('../deferred_to_promise');


const closeDatabase = name =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(name);
    request.onblocked = () => {
      reject(new Error(`Database '${name}' blocked`));
    };
    request.onupgradeneeded = (event) => {
      reject(new Error('Unexpected database upgraded needed:' +
        ` oldVersion: ${event.oldVersion}, newVersion: ${event.newVersion}`));
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
    request.onsuccess = (event) => {
      const connection = event.target.result;
      connection.close();
      resolve();
    };
  });

exports.runMigrations = async ({ Backbone, database } = {}) => {
  if (!isObject(Backbone) || !isObject(Backbone.Collection) ||
      !isFunction(Backbone.Collection.extend)) {
    throw new TypeError('"Backbone" is required');
  }

  if (!isObject(database) || !isString(database.id) ||
      !Array.isArray(database.migrations)) {
    throw new TypeError('"database" is required');
  }

  const migrationCollection = new (Backbone.Collection.extend({
    database,
    storeName: 'items',
  }))();

  await deferredToPromise(migrationCollection.fetch({ limit: 1 }));
  await closeDatabase(database.id);
};
