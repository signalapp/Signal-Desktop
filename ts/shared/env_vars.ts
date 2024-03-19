function envAppInstanceIncludes(prefix: string) {
  if (!process.env.NODE_APP_INSTANCE) {
    return false;
  }
  return !!process.env.NODE_APP_INSTANCE.includes(prefix);
}

export function isCI() {
  // this is set by session-playwright to run a build on CI
  return !!process.env.CI;
}

export function isDevProd() {
  return envAppInstanceIncludes('devprod');
}

export function isTestNet() {
  return envAppInstanceIncludes('testnet') || isCI(); // when running on CI, we always want to use testnet
}

export function isTestIntegration() {
  return envAppInstanceIncludes('test-integration') || isCI(); // when running on CI, we always want the 'test-integration' behavior
}
