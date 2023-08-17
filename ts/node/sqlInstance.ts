import * as BetterSqlite3 from '@signalapp/better-sqlite3';

let globalInstance: BetterSqlite3.Database | null = null;

export function assertGlobalInstance(): BetterSqlite3.Database {
  if (!globalInstance) {
    throw new Error('globalInstance is not initialized.');
  }
  return globalInstance;
}

export function isInstanceInitialized(): boolean {
  return !!globalInstance;
}

export function assertGlobalInstanceOrInstance(
  instance?: BetterSqlite3.Database | null
): BetterSqlite3.Database {
  // if none of them are initialized, throw
  if (!globalInstance && !instance) {
    throw new Error('neither globalInstance nor initialized is initialized.');
  }
  // otherwise, return which ever is true, priority to the global one
  return globalInstance || (instance as BetterSqlite3.Database);
}

export function initDbInstanceWith(instance: BetterSqlite3.Database) {
  if (globalInstance) {
    throw new Error('already init');
  }
  globalInstance = instance;
}

export function closeDbInstance() {
  if (!globalInstance) {
    return;
  }
  const dbRef = globalInstance;
  globalInstance = null;
  // SQLLite documentation suggests that we run `PRAGMA optimize` right before
  // closing the database connection.
  dbRef.pragma('optimize');
  dbRef.close();
}
