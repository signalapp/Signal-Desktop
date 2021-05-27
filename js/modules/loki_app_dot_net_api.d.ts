export interface LokiAppDotNetServerInterface {
  serverRequest(endpoint: string): Promise<any>;
}

declare class LokiAppDotNetServerAPI implements LokiAppDotNetServerInterface {
  public baseServerUrl: string;
  constructor(ourKey: string, url: string);
}

export default LokiAppDotNetServerAPI;
