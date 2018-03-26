const isFunction = require('lodash/isFunction');
const isObject = require('lodash/isObject');
const isString = require('lodash/isString');


exports.runMigrations = ({ Backbone, database } = {}) => {
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

  return new Promise((resolve) => {
    // NOTE: This `then` refers to a jQuery `Deferred`:
    // eslint-disable-next-line more/no-then
    migrationCollection.fetch().then(() => resolve());
  });
};
