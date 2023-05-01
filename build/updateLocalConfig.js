var fs = require('fs');
var _ = require('lodash');
var execSync = require('child_process').execSync;

const updateLocalConfig = () => {
  var environment = process.env.SIGNAL_ENV || 'production';
  var configPath = `config/local-${environment}.json`;
  var localConfig;

  var hash = '';
  try {
    // this was tested on windows, linux and macOS builds through the CI and works fine, but might require to make git available in the PATH when building unofficial builds.
    // this is used to udpate the hash of the commit in the UI at the bottom of the settings screen, and in the about view
    var stdout = execSync('git rev-parse HEAD').toString();
    console.info('"git rev-parse HEAD" result: ', stdout && stdout.trim());

    if (!_.isEmpty(stdout)) {
      hash = stdout.trim();
    }
    var rawdata = fs.readFileSync(configPath);
    localConfig = JSON.parse(rawdata);
  } catch (e) {
    console.error('updateLocalConfig failed with', e.message);
  }

  localConfig = {
    ...localConfig,
    commitHash: hash,
  };
  var toWrite = `${JSON.stringify(localConfig)}\n`;
  fs.writeFileSync(configPath, toWrite);
};

updateLocalConfig();
