import * as BetterSqlite3 from '@signalapp/better-sqlite3';
import { CONFIG_DUMP_TABLE, ConfigDumpRow } from '../../../types/sqlSharedTypes';
import { checkTargetMigration } from '../utils';

const targetVersion = 33;

function fetchUserConfigDump(
  db: BetterSqlite3.Database,
  version: number,
  userPubkeyhex: string
): ConfigDumpRow | null {
  checkTargetMigration(version, targetVersion);

  const userConfigWrapperDumps = db
    .prepare(
      `SELECT * FROM ${CONFIG_DUMP_TABLE} WHERE variant = $variant AND publicKey = $publicKey;`
    )
    .all({ variant: 'UserConfig', publicKey: userPubkeyhex }) as Array<ConfigDumpRow>;

  if (!userConfigWrapperDumps || !userConfigWrapperDumps.length) {
    return null;
  }
  // we can only have one dump with the "UserConfig" variant and our pubkey
  return userConfigWrapperDumps[0];
}

function writeUserConfigDump(
  db: BetterSqlite3.Database,
  version: number,
  userPubkeyhex: string,
  dump: Uint8Array
) {
  checkTargetMigration(version, targetVersion);

  db.prepare(
    `INSERT OR REPLACE INTO ${CONFIG_DUMP_TABLE} (
            publicKey,
            variant,
            data
        ) values (
          $publicKey,
          $variant,
          $data
        );`
  ).run({
    publicKey: userPubkeyhex,
    variant: 'UserConfig',
    data: dump,
  });
}

export const V33 = { fetchUserConfigDump, writeUserConfigDump };
