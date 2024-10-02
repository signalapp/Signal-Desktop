// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parse } from 'csv-parse';
import fs from 'fs/promises';
import { z } from 'zod';
import { _getAvailableLocales } from '../../app/locale';
import { parseUnknown } from '../util/schemas';

const type = process.argv[2];
if (type !== 'countries' && type !== 'locales') {
  throw new Error('Invalid first argument, expceted "countries" or "locales"');
}

const localeDisplayNamesDataPath = process.argv[3];
if (!localeDisplayNamesDataPath) {
  throw new Error('Missing second argument: source csv file');
}
const localeDisplayNamesBuildPath = process.argv[4];
if (!localeDisplayNamesBuildPath) {
  throw new Error('Missing third argument: output json file');
}

const availableLocales = _getAvailableLocales();

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

type Row = ReadonlyArray<string>;
type Records = ReadonlyArray<Row>;

function parseCsv(input: string) {
  return new Promise<Records>((resolve, reject) => {
    parse(input, { trim: true }, (error, records: Records) => {
      if (error) {
        reject(error);
      } else {
        resolve(records);
      }
    });
  });
}

type LocaleDisplayNamesResult = Record<string, Record<string, string>>;

function convertData(
  input: z.infer<typeof LocaleDisplayNames>
): LocaleDisplayNamesResult {
  const [[, ...keys], ...rows] = input;
  const result: LocaleDisplayNamesResult = {};

  if (type === 'locales') {
    for (const row of rows) {
      const [subKey, ...messages] = row;

      result[subKey] = {};
      for (const [index, message] of messages.entries()) {
        result[subKey][keys[index]] = message;
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
        result[keys[index]][subKey] = message;
      }
    }
  }
  return result;
}

function assertValuesForAllLocales(result: LocaleDisplayNamesResult) {
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

function assertValuesForAllCountries(result: LocaleDisplayNamesResult) {
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

async function main() {
  const contents = await fs.readFile(localeDisplayNamesDataPath, 'utf-8');
  const records = await parseCsv(contents);
  const data = parseUnknown(LocaleDisplayNames, records as unknown);
  const result = convertData(data);
  if (type === 'locales') {
    assertValuesForAllLocales(result);
  } else if (type === 'countries') {
    assertValuesForAllCountries(result);
  }
  const json = JSON.stringify(result, null, 2);
  await fs.writeFile(localeDisplayNamesBuildPath, json, 'utf-8');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
