// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global i18n, Whisper, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};
  const { Logs } = window.Signal;

  const CLEAR_DATA_STEPS = {
    CHOICE: 1,
    DELETING: 2,
  };
  window.Whisper.ClearDataView = Whisper.View.extend({
    template: () => $('#clear-data').html(),
    className: 'full-screen-flow overlay',
    events: {
      'click .cancel': 'onCancel',
      'click .delete-all-data': 'onDeleteAllData',
    },
    initialize() {
      this.step = CLEAR_DATA_STEPS.CHOICE;
    },
    onCancel() {
      this.remove();
    },
    async onDeleteAllData() {
      window.log.info('Deleting everything!');
      this.step = CLEAR_DATA_STEPS.DELETING;
      this.render();

      await this.clearAllData();
    },
    async clearAllData() {
      try {
        await Logs.deleteAll();

        window.log.info('clearAllData: deleted all logs');

        await window.Signal.Data.removeAll();

        window.log.info('clearAllData: emptied database');

        await window.Signal.Data.close();

        window.log.info('clearAllData: closed database');

        await window.Signal.Data.removeDB();

        window.log.info('clearAllData: removed database');

        await window.Signal.Data.removeOtherData();

        window.log.info('clearAllData: removed all other data');
      } catch (error) {
        window.log.error(
          'Something went wrong deleting all data:',
          error && error.stack ? error.stack : error
        );
      }
      window.restart();
    },
    render_attributes() {
      return {
        isStep1: this.step === CLEAR_DATA_STEPS.CHOICE,
        header: i18n('deleteAllDataHeader'),
        body: i18n('deleteAllDataBody'),
        cancelButton: i18n('cancel'),
        deleteButton: i18n('deleteAllDataButton'),

        isStep2: this.step === CLEAR_DATA_STEPS.DELETING,
        deleting: i18n('deleteAllDataProgress'),
      };
    },
  });
})();
