import PQueue from 'p-queue';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';

function createJobQueue(label: string) {
  const jobQueue = new PQueue({ concurrency: 1 });

  return (job: () => Promise<void>, id = '') => {
    const taskWithTimeout = createTaskWithTimeout(job, `${label} ${id}`);

    return jobQueue.add(taskWithTimeout);
  };
}

export const storageJobQueue = createJobQueue('storageService');
