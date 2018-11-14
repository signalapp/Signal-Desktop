/* global i18n: false */
/* global Whisper: false */

/* eslint-disable no-new */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};
  const { Logs } = window.Signal;

  const CLEAR_DATA_STEPS = {
    CHOICE: 1,
    DELETING: 2,
  };
  window.Whisper.ClearDataView = Whisper.View.extend({
    templateName: 'clear-data',
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

        await window.Signal.Data.removeAll();
        await window.Signal.Data.close();
        await window.Signal.Data.removeDB();

        await window.Signal.Data.removeOtherData();
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
