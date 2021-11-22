// tslint:disable: no-console
// tslint:disable no-implicit-dependencies
import { expect } from 'chai';
import { _electron as electron, ElectronApplication, Page } from 'playwright';

const NODE_ENV = 'integration-test';

function throwIfNoFirstInstance(
  instanceToCastIfValid: ElectronApplication | null,
  pageToCastIfValid: Page | null
): { instance: ElectronApplication; page: Page } {
  if (!instanceToCastIfValid) {
    throw new Error('no instanceToCastIfValid');
  }
  if (!pageToCastIfValid) {
    throw new Error('no pageToCastIfValid');
  }
  return { page: pageToCastIfValid, instance: instanceToCastIfValid };
}

async function createAppInstance(MULTI: number) {
  // Launch Electron app.
  process.env.NODE_ENV = NODE_ENV;
  process.env.NODE_APP_INSTANCE = `${MULTI}`;
  const instance = await electron.launch({
    args: ['main.js'],
  });

  // Get the first window that the app opens, wait if necessary.
  const page = await instance.firstWindow();
  //   page.on('console', console.log);
  return { instance, page };
}

async function killAppInstance(appInstance?: ElectronApplication | null) {
  // Kill Electron app.
  if (appInstance) {
    await appInstance.close();
  }
  return null;
}

describe('quick test', () => {
  let firstAppInstance: ElectronApplication | null = null;
  let firstAppPage: Page | null = null;

  beforeEach(async () => {
    if (firstAppInstance) {
      throw new Error('beforeAll cannot create first instance');
    }
    const { instance, page } = await createAppInstance(1);
    firstAppInstance = instance;
    firstAppPage = page;
  });

  afterEach(async () => {
    firstAppInstance = await killAppInstance(firstAppInstance);
  });

  it('check "Begin your Session" is shown on app start', async () => {
    const { instance, page } = throwIfNoFirstInstance(firstAppInstance, firstAppPage);
    // Evaluation expression in the Electron context.
    const appPath = await instance.evaluate(async ({ app }) => {
      // This runs in the main Electron process, parameter here is always
      // the result of the require('electron') in the main app script.
      return app.getAppPath();
    });
    console.log(appPath);
    // Print the title.instance
    const title = await page.title();

    const beginSessionSelector = await page.waitForSelector(
      'div.session-content-accent-text.title'
    );
    const contentBeginYourSession = await beginSessionSelector.innerHTML();
    expect(contentBeginYourSession).to.equal('Begin your Session.');

    expect(title).to.eq('Session');
  });
});
