import { v4 as uuid } from 'uuid';

// TODO: This needs to replace js/modules/job_queue.js
export class JobQueue {
  private pending: Promise<any> = Promise.resolve();
  private readonly jobs: Map<string, Promise<any>> = new Map();

  public has(id: string): boolean {
    return this.jobs.has(id);
  }

  public async add(job: () => any): Promise<any> {
    const id = uuid();

    return this.addWithId(id, job);
  }

  public async addWithId(id: string, job: () => any): Promise<any> {
    if (this.jobs.has(id)) {
      return this.jobs.get(id);
    }

    const previous = this.pending || Promise.resolve();
    this.pending = previous.then(job, job);

    const current = this.pending;
    current
      .finally(() => {
        if (this.pending === current) {
          delete this.pending;
        }
        this.jobs.delete(id);
      })
      .ignore();

    this.jobs.set(id, current);

    return current;
  }
}
