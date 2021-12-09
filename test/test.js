// Copyright 2014-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, _, Backbone */

// Override the database id.
window.Whisper = window.Whisper || {};
window.Whisper.Database = window.Whisper.Database || {};
Whisper.Database.id = 'test';

/*
 * global helpers for tests
 */

function deleteIndexedDB() {
  return new Promise((resolve, reject) => {
    const idbReq = indexedDB.deleteDatabase('test');
    idbReq.onsuccess = resolve;
    idbReq.error = reject;
  });
}

/* Delete the database before running any tests */
before(async () => {
  window.Signal.Util.MessageController.install();

  await deleteIndexedDB();
  try {
    window.SignalContext.log.info('Initializing SQL in renderer');
    const isTesting = true;
    await window.Signal.Data.startInRenderer(isTesting);
    window.SignalContext.log.info('SQL initialized in renderer');
  } catch (err) {
    window.SignalContext.log.error(
      'SQL failed to initialize',
      err && err.stack ? err.stack : err
    );
  }
  await window.Signal.Util.initializeMessageCounter();
  await window.Signal.Data.removeAll();
  await window.storage.fetch();
});

window.Whisper = window.Whisper || {};
window.Whisper.events = _.clone(Backbone.Events);
