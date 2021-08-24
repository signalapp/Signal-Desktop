// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function deleteAllData(): Promise<void> {
  try {
    await window.Signal.Logs.deleteAll();

    window.log.info('deleteAllData: deleted all logs');

    await window.Signal.Data.removeAll();

    window.log.info('deleteAllData: emptied database');

    await window.Signal.Data.close();

    window.log.info('deleteAllData: closed database');

    await window.Signal.Data.removeDB();

    window.log.info('deleteAllData: removed database');

    await window.Signal.Data.removeOtherData();

    window.log.info('deleteAllData: removed all other data');
  } catch (error) {
    window.log.error(
      'Something went wrong deleting all data:',
      error && error.stack ? error.stack : error
    );
  }
  window.restart();
}
