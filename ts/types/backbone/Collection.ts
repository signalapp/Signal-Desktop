import { Model } from './Model';

export interface Collection<T> {
  models: Array<Model<T>>;
  // tslint:disable-next-line no-misused-new
  new (): Collection<T>;
  fetch(options: object): JQuery.Deferred<any>;
}
