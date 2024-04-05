const path = require('path');
const fs = require('fs');
const util = require('util');

const renameAsync = util.promisify(fs.rename);
const unlinkAsync = util.promisify(fs.unlink);

module.exports = async function (context) {
  // Replace the app launcher on linux only.
  if (process.platform !== 'linux') {
    return;
  }
  const isAppImage =
    context.targets.name === 'appImage' || context.targets.some(e => e.name === 'appImage');
  console.log(
    'targets',
    context.targets.map(target => target.name)
  );

  console.log('AppImage', isAppImage);

  if (!isAppImage) {
    console.log('afterPack hook not triggered as this is not an appImage build');

    return;
  }
  // eslint-disable-next-line no-console
  // console.log('afterPack hook triggered', context);

  const executableName = context.packager.executableName;
  const sourceExecutable = path.join(context.appOutDir, executableName);
  const targetExecutable = path.join(context.appOutDir, `${executableName}-bin`);
  const launcherScript = path.join(context.appOutDir, 'resources', 'launcher-script.sh');
  const chromeSandbox = path.join(context.appOutDir, 'chrome-sandbox');
  // rename session-desktop to session-desktop-bin
  await renameAsync(sourceExecutable, targetExecutable);
  // rename launcher script to session-desktop
  await renameAsync(launcherScript, sourceExecutable);
  // remove the chrome-sandbox file since we explicitly disable it
  return unlinkAsync(chromeSandbox);
};
