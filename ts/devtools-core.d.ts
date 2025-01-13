// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'react-devtools-core' {
  type DevToolsOptions = {
    useHttps?: boolean;
  };

  function initialize(): void;

  function connectToDevTools(options?: DevToolsOptions): void;

  export { initialize, connectToDevTools };
}
