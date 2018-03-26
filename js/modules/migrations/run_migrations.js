const isFunction = require('lodash/isFunction');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');

const { deferredToPromise } = require('../deferred_to_promise');


exports.runMigrations = async ({ Backbone, closeDatabase, database } = {}) => {
  if (!isObject(Backbone) || !isObject(Backbone.Collection) ||
      !isFunction(Backbone.Collection.extend)) {
    throw new TypeError('"Backbone" is required');
  }

  if (!isFunction(closeDatabase)) {
    throw new TypeError('"closeDatabase" is required');
  }

  if (!isObject(database) || !isString(database.id) ||
      !Array.isArray(database.migrations)) {
    throw new TypeError('"database" is required');
  }

  const migrationCollection = new (Backbone.Collection.extend({
    database,
    storeName: 'items',
  }))();

  await deferredToPromise(migrationCollection.fetch());
  await closeDatabase();
  return;
};
