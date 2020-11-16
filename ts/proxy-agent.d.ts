// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'proxy-agent' {
  import { Agent } from 'http';

  export default class ProxyAgent extends Agent {
    constructor(url: string);
  }
}
