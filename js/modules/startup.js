const is = require('@sindresorhus/is');

const Errors = require('./types/errors');
const Settings = require('./settings');


exports.syncReadReceiptConfiguration = async ({
  deviceId,
  sendRequestConfigurationSyncMessage,
  storage,
}) => {
  if (!is.string(deviceId)) {
    throw new TypeError("'deviceId' is required");
  }

  if (!is.function(sendRequestConfigurationSyncMessage)) {
    throw new TypeError("'sendRequestConfigurationSyncMessage' is required");
  }

  if (!is.object(storage)) {
    throw new TypeError("'storage' is required");
  }

  const isPrimaryDevice = deviceId === '1';
  if (isPrimaryDevice) {
    return {
      status: 'skipped',
      reason: 'isPrimaryDevice',
    };
  }

  const settingName = Settings.READ_RECEIPT_CONFIGURATION_SYNC;
  const hasPreviouslySynced = Boolean(storage.get(settingName));
  if (hasPreviouslySynced) {
    return {
      status: 'skipped',
      reason: 'hasPreviouslySynced',
    };
  }

  try {
    await sendRequestConfigurationSyncMessage();
    storage.put(settingName, true);
  } catch (error) {
    return {
      status: 'error',
      reason: 'failedToSendSyncMessage',
      error: Errors.toLogFormat(error),
    };
  }

  return {
    status: 'complete',
  };
};
