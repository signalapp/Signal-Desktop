/* eslint-env browser */

const isFunction = require('lodash/isFunction');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');

const { deferredToPromise } = require('../deferred_to_promise');


const closeDatabaseConnection = ({ Backbone } = {}) =>
  deferredToPromise(Backbone.sync('closeall'));

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
  console.log('Close database connection');
  await closeDatabaseConnection({ Backbone });
};
