declare module 'proxy-agent' {
  import { Agent } from 'http';

  export default class ProxyAgent extends Agent {
    constructor(url: string);
  }
}
