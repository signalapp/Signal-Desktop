// Add version and commit hash

global.setTimeout(() => {
  const version = document.getElementsByClassName('version').item(0);

  const commit = document.getElementsByClassName('commitHash').item(0);
  const environment = document.getElementsByClassName('environment').item(0);

  // Add debugging metadata - environment if not production, app instance name
  const states = [];

  if (window.getEnvironment() !== 'production') {
    states.push(window.getEnvironment());
  }
  if (window.getAppInstance()) {
    states.push(window.getAppInstance());
  }
  if (version) {
    // tslint:disable: no-inner-html
    version.innerHTML = `v${window.getVersion()}`;
  }

  if (commit) {
    commit.innerHTML = window.getCommitHash() || '';
  }

  if (environment) {
    environment.innerHTML = states.join(' - ');
  }
}, 1000);
