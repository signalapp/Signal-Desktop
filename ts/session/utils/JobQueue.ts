import { v4 as uuid } from 'uuid';

type Job<ResultType> = (() => PromiseLike<ResultType>) | (() => ResultType);

export class JobQueue {
  private pending?: Promise<any> = Promise.resolve();
  private readonly jobs: Map<string, Promise<unknown>> = new Map();

  public has(id: string): boolean {
    return this.jobs.has(id);
  }

  public async add<Result>(job: Job<Result>): Promise<Result> {
    const id = uuid();

    return this.addWithId(id, job);
  }

  public async addWithId<Result>(id: string, job: Job<Result>): Promise<Result> {
    if (this.jobs.has(id)) {
      return this.jobs.get(id) as Promise<Result>;
    }

    const previous = this.pending || Promise.resolve();
    // eslint-disable-next-line more/no-then
    this.pending = previous.then(job, job);

    const current = this.pending;
    void current
      .catch(() => {
        // This is done to avoid UnhandledPromiseError
      })
      .finally(() => {
        if (this.pending === current) {
          delete this?.pending;
        }
        this.jobs.delete(id);
      });

    this.jobs.set(id, current);

    return current;
  }
}
