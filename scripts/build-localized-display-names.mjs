// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { parse } from 'csv-parse';
import fs from 'node:fs/promises';
import { z } from 'zod';
import availableLocales from '../build/available-locales.json' with { type: 'json' };
import { assert } from './utils/assert.mjs';

const type = process.argv[2];
if (type !== 'countries' && type !== 'locales') {
  throw new Error('Invalid first argument, expected "countries" or "locales"');
}

if (!process.argv[3]) {
  throw new Error('Missing second argument: source csv file');
}
const localeDisplayNamesDataPath = process.argv[3];

if (!process.argv[4]) {
  throw new Error('Missing third argument: output json file');
}
const localeDisplayNamesBuildPath = process.argv[4];

const LocaleString = z.string().refine(arg => {
  try {
    return new Intl.Locale(arg) && true;
  } catch {
    return false;
  }
});

const LocaleDisplayNames = z
  .tuple([
    z
      .tuple([z.literal(type === 'locales' ? 'locale' : 'Country Code')])
      .rest(LocaleString),
  ])
  .rest(z.tuple([LocaleString]).rest(z.string()));

/** @typedef {ReadonlyArray<string>} Row */
/** @typedef {ReadonlyArray<Row>} Records */

/**
 * @param {string} input
 * @returns {Promise<Records>}
 */
function parseCsv(input) {
  return new Promise((resolve, reject) => {
    parse(input, { trim: true }, (error, records) => {
      if (error) {
        reject(error);
      } else {
        resolve(records);
      }
    });
  });
}

/** @typedef {Record<string, Record<string, string>>} LocaleDisplayNamesResult */

/**
 * @param {z.infer<typeof LocaleDisplayNames>} input
 * @returns {LocaleDisplayNamesResult}
 */
function convertData(input) {
  const [[, ...keys], ...rows] = input;

  /** @type {LocaleDisplayNamesResult} */
  const result = {};

  if (type === 'locales') {
    for (const row of rows) {
      const [subKey, ...messages] = row;

      result[subKey] = {};
      for (const [index, message] of messages.entries()) {
        const key = keys[index];
        assert(key != null, 'Missing key');
        result[subKey][key] = message;
      }
    }
  } else {
    // Countries use transposed matrix.
    for (const key of keys) {
      result[key] = {};
    }

    for (const row of rows) {
      const [subKey, ...messages] = row;

      for (const [index, message] of messages.entries()) {
        const key = keys[index];
        assert(key != null, 'Missing key');
        const values = result[key];
        assert(values != null, 'Missing values');
        values[subKey] = message;
      }
    }
  }
  return result;
}

/**
 * @param {LocaleDisplayNamesResult} result
 */
function assertValuesForAllLocales(result) {
  for (const locale of availableLocales) {
    const values = result[locale];
    if (values == null) {
      throw new Error(`Missing values for locale ${locale}`);
    }
    for (const innerLocale of availableLocales) {
      if (values[innerLocale] == null) {
        throw new Error(`Missing value for locale ${locale} -> ${innerLocale}`);
      }
    }
  }
}

/**
 * @param {LocaleDisplayNamesResult} result
 */
function assertValuesForAllCountries(result) {
  assert(result.en != null, 'Missing result.en');
  const availableCountries = Object.keys(result.en);
  for (const locale of availableLocales) {
    const values = result[locale];
    if (values == null) {
      throw new Error(`Missing values for locale ${locale}`);
    }
    for (const country of availableCountries) {
      if (values[country] == null) {
        throw new Error(`Missing value for country ${locale} -> ${country}`);
      }
    }
  }
}

const contents = await fs.readFile(localeDisplayNamesDataPath, 'utf-8');
const records = await parseCsv(contents);
const data = LocaleDisplayNames.parse(records);
const result = convertData(data);
if (type === 'locales') {
  assertValuesForAllLocales(result);
} else if (type === 'countries') {
  assertValuesForAllCountries(result);
}
const json = JSON.stringify(result, null, 2);
await fs.writeFile(localeDisplayNamesBuildPath, json, 'utf-8');
