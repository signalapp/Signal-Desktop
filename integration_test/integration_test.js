/* eslint-disable no-console */
/* eslint-disable more/no-then */
/* eslint-disable global-require */
/* eslint-disable import/no-extraneous-dependencies */

const { before } = require('mocha');
const common = require('./common');

require('./registration_test');
require('./open_group_test');
require('./add_friends_test');
require('./link_device_test');
require('./closed_group_test');
require('./message_functions_test');
require('./settings_test');
require('./sender_keys_test');

before(async () => {
  // start the app once before all tests to get the platform-dependent
  // path of user data and store it to common.USER_DATA_ROOT_FOLDER
  const app1 = await common.startApp();
  common.USER_DATA_ROOT_FOLDER = await app1.electron.remote.app.getPath(
    'appData'
  );
  await common.stopApp(app1);
});
