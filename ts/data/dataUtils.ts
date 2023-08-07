/* eslint-disable no-param-reassign */
import _ from 'lodash';

/**
 * When IPC arguments are prepared for the cross-process send, they are JSON.stringified.
 * We can't send ArrayBuffers or BigNumbers (what we get from proto library for dates).
 * @param data - data to be cleaned
 */
export function cleanData(data: any): any {
  const keys = Object.keys(data);

  for (let index = 0, max = keys.length; index < max; index += 1) {
    const key = keys[index];
    const value = data[key];

    if (value === null || value === undefined) {
      // eslint-disable-next-line no-continue
      continue;
    }
    // eslint-disable no-param-reassign

    if (_.isFunction(value.toNumber)) {
      // eslint-disable-next-line no-param-reassign
      data[key] = value.toNumber();
    } else if (_.isFunction(value)) {
      // just skip a function which has not a toNumber function. We don't want to save a function to the db.
      // an attachment comes with a toJson() function

      delete data[key];
    } else if (Array.isArray(value)) {
      data[key] = value.map(cleanData);
    } else if (_.isObject(value) && value instanceof File) {
      data[key] = { name: value.name, path: value.path, size: value.size, type: value.type };
    } else if (_.isObject(value) && value instanceof ArrayBuffer) {
      window.log.error(
        'Trying to save an ArrayBuffer to the db is most likely an error. This specific field should be removed before the cleanData call'
      );
      /// just skip it
      continue;
    } else if (_.isObject(value)) {
      data[key] = cleanData(value);
    } else if (_.isBoolean(value)) {
      data[key] = value ? 1 : 0;
    } else if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      window?.log?.info(`cleanData: key ${key} had type ${typeof value}`);
    }
  }
  return data;
}
