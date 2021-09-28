// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { openLinkInWebBrowser } from '../util/openLinkInWebBrowser';
import { HTTPError } from '../textsecure/Errors';

window.Whisper = window.Whisper || {};
const { Whisper } = window;

enum Steps {
  INSTALL_SIGNAL = 2,
  SCAN_QR_CODE = 3,
  ENTER_NAME = 4,
  PROGRESS_BAR = 5,
  TOO_MANY_DEVICES = 'TooManyDevices',
  NETWORK_ERROR = 'NetworkError',
}

const DEVICE_NAME_SELECTOR = 'input.device-name';
const CONNECTION_ERROR = -1;
const TOO_MANY_DEVICES = 411;
const TOO_OLD = 409;

Whisper.InstallView = Whisper.View.extend({
  template: () => $('#link-flow-template').html(),
  className: 'main full-screen-flow',
  events: {
    'click .try-again': 'connect',
    'click .second': 'shutdown',
    // the actual next step happens in confirmNumber() on submit form #link-phone
  },
  initialize(options: { hasExistingData?: boolean } = {}) {
    window.readyForUpdates();

    this.selectStep(Steps.SCAN_QR_CODE);
    this.connect();
    this.on('disconnected', this.reconnect);

    // Keep data around if it's a re-link, or the middle of a light import
    this.shouldRetainData =
      window.Signal.Util.Registration.everDone() || options.hasExistingData;
  },
  render_attributes() {
    let errorMessage;
    let errorButton = window.i18n('installTryAgain');
    let errorSecondButton = null;

    if (this.error) {
      if (
        this.error instanceof HTTPError &&
        this.error.code === TOO_MANY_DEVICES
      ) {
        errorMessage = window.i18n('installTooManyDevices');
      } else if (
        this.error instanceof HTTPError &&
        this.error.code === TOO_OLD
      ) {
        errorMessage = window.i18n('installTooOld');
        errorButton = window.i18n('upgrade');
        errorSecondButton = window.i18n('quit');
      } else if (
        this.error instanceof HTTPError &&
        this.error.code === CONNECTION_ERROR
      ) {
        errorMessage = window.i18n('installConnectionFailed');
      } else if (this.error.message === 'websocket closed') {
        // AccountManager.registerSecondDevice uses this specific
        //   'websocket closed' error message
        errorMessage = window.i18n('installConnectionFailed');
      }

      return {
        isError: true,
        errorHeader: window.i18n('installErrorHeader'),
        errorMessage,
        errorButton,
        errorSecondButton,
      };
    }

    return {
      isStep3: this.step === Steps.SCAN_QR_CODE,
      linkYourPhone: window.i18n('linkYourPhone'),
      signalSettings: window.i18n('signalSettings'),
      linkedDevices: window.i18n('linkedDevices'),
      androidFinalStep: window.i18n('plusButton'),
      appleFinalStep: window.i18n('linkNewDevice'),

      isStep4: this.step === Steps.ENTER_NAME,
      chooseName: window.i18n('chooseDeviceName'),
      finishLinkingPhoneButton: window.i18n('finishLinkingPhone'),

      isStep5: this.step === Steps.PROGRESS_BAR,
      syncing: window.i18n('initialSync'),
    };
  },
  selectStep(step: Steps) {
    this.step = step;
    this.render();
  },
  shutdown() {
    window.shutdown();
  },
  async connect() {
    if (this.error instanceof HTTPError && this.error.code === TOO_OLD) {
      openLinkInWebBrowser('https://signal.org/download');
      return;
    }

    this.error = null;
    this.selectStep(Steps.SCAN_QR_CODE);
    this.clearQR();
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    const accountManager = window.getAccountManager();

    try {
      await accountManager.registerSecondDevice(
        this.setProvisioningUrl.bind(this),
        this.confirmNumber.bind(this)
      );
    } catch (err) {
      this.handleDisconnect(err);
    }
  },
  handleDisconnect(error: Error) {
    log.error(
      'provisioning failed',
      error && error.stack ? error.stack : error
    );

    this.error = error;
    this.render();

    if (error.message === 'websocket closed') {
      this.trigger('disconnected');
    } else if (
      !(error instanceof HTTPError) ||
      (error.code !== CONNECTION_ERROR && error.code !== TOO_MANY_DEVICES)
    ) {
      throw error;
    }
  },
  reconnect() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.timeout = setTimeout(this.connect.bind(this), 10000);
  },
  clearQR() {
    this.$('#qr img').remove();
    this.$('#qr canvas').remove();
    this.$('#qr .container').show();
    this.$('#qr').removeClass('ready');
  },
  setProvisioningUrl(url: string) {
    if ($('#qr').length === 0) {
      log.error('Did not find #qr element in the DOM!');
      return;
    }

    this.clearQR();
    this.$('#qr .container').hide();
    this.qr = new window.QRCode(this.$('#qr')[0]).makeCode(url);
    this.$('#qr').removeAttr('title');
    this.$('#qr').addClass('ready');
    this.$('#qr img').attr('alt', window.i18n('LinkScreen__scan-this-code'));
  },
  setDeviceNameDefault() {
    const deviceName = window.textsecure.storage.user.getDeviceName();

    this.$(DEVICE_NAME_SELECTOR).val(deviceName || window.getHostName());
    this.$(DEVICE_NAME_SELECTOR).focus();
  },
  confirmNumber() {
    window.removeSetupMenuItems();
    this.selectStep(Steps.ENTER_NAME);
    this.setDeviceNameDefault();

    return new Promise(resolve => {
      const onDeviceName = async (name: string) => {
        this.selectStep(Steps.PROGRESS_BAR);

        const finish = () => {
          window.Signal.Util.postLinkExperience.start();
          return resolve(name);
        };

        // Delete all data from database unless we're in the middle
        //   of a re-link, or we are finishing a light import. Without this,
        //   app restarts at certain times can cause weird things to happen,
        //   like data from a previous incomplete light import showing up
        //   after a new install.
        if (this.shouldRetainData) {
          return finish();
        }

        try {
          await window.textsecure.storage.protocol.removeAllData();
        } catch (error) {
          log.error(
            'confirmNumber: error clearing database',
            error && error.stack ? error.stack : error
          );
        } finally {
          finish();
        }
      };

      if (window.CI) {
        onDeviceName(window.CI.deviceName);
        return;
      }

      // eslint-disable-next-line consistent-return
      this.$('#link-phone').submit((e: SubmitEvent) => {
        e.stopPropagation();
        e.preventDefault();

        let name = this.$(DEVICE_NAME_SELECTOR).val();
        name = name.replace(/\0/g, ''); // strip unicode null
        if (name.trim().length === 0) {
          this.$(DEVICE_NAME_SELECTOR).focus();
          return;
        }

        onDeviceName(name);
      });
    });
  },
});
