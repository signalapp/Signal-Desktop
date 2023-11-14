// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { parse } from 'csv-parse';
import path from 'path';
import fs from 'fs/promises';
import { z } from 'zod';
import { _getAvailableLocales } from '../../app/locale';

const availableLocales = _getAvailableLocales();

const LocaleString = z.string().refine(arg => {
  try {
    return new Intl.Locale(arg) && true;
  } catch {
    return false;
  }
});

const LocaleDisplayNames = z
  .tuple([z.tuple([z.literal('locale')]).rest(LocaleString)])
  .rest(z.tuple([LocaleString]).rest(z.string()));

type Row = ReadonlyArray<string>;
type Records = ReadonlyArray<Row>;

const localeDataDir = path.join(__dirname, 'locale-data');
const localeDisplayNamesDataPath = path.join(
  localeDataDir,
  'locale-display-names.csv'
);
const buildDir = path.join(__dirname, '..', '..', 'build');
const localeDisplayNamesBuildPath = path.join(
  buildDir,
  'locale-display-names.json'
);

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
  const result = Object.fromEntries(
    rows.map(row => {
      const [key, ...messages] = row;
      const value = Object.fromEntries(
        messages.map((message, index) => {
          return [keys[index], message];
        })
      );
      return [key, value];
    })
  );
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

async function main() {
  const contents = await fs.readFile(localeDisplayNamesDataPath, 'utf-8');
  const records = await parseCsv(contents);
  const data = LocaleDisplayNames.parse(records);
  const result = convertData(data);
  assertValuesForAllLocales(result);
  const json = JSON.stringify(result, null, 2);
  await fs.writeFile(localeDisplayNamesBuildPath, json, 'utf-8');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
