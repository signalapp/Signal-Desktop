import { PendingMessageCache } from '../../../../session/sending';
import { RawMessage } from '../../../../session/types';

export class PendingMessageCacheStub extends PendingMessageCache {
  public dbData: Array<RawMessage>;
  constructor(dbData: Array<RawMessage> = []) {
    super();
    this.dbData = dbData;
  }

  public getCache(): Readonly<Array<RawMessage>> {
    return this.cache;
  }

  protected async getFromStorage() {
    return this.dbData;
  }

  // eslint-disable-next-line  no-empty-function
  protected async saveToDB() {}
}
