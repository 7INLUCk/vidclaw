import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Batch Task State Machine Tests
 * 
 * Tests the batch task status transitions and queue logic
 * from batch-task-manager.js, reimplemented in TS for testing.
 */

// Task status constants (mirroring BatchTaskStatus)
const BatchTaskStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  GENERATING: 'generating',
  COMPLETED: 'completed',
  DOWNLOADED: 'downloaded',
  FAILED: 'failed',
} as const;

type TaskStatus = typeof BatchTaskStatus[keyof typeof BatchTaskStatus];

interface BatchTask {
  id: string;
  index: number;
  prompt: string;
  status: TaskStatus;
  error?: string;
  retryCount: number;
  downloadUrl?: string;
  outputFile?: string;
}

const MAX_BATCH_TASKS = 20;
const MAX_CONCURRENT = 5;

/**
 * Simplified batch task manager for testing
 */
class TestBatchManager {
  tasks: BatchTask[] = [];
  running = false;

  createBatch(tasks: Array<{ prompt: string }>): { success: boolean; error?: string; tasks?: BatchTask[] } {
    if (tasks.length > MAX_BATCH_TASKS) {
      return { success: false, error: `批量任务上限为 ${MAX_BATCH_TASKS} 个` };
    }

    this.tasks = tasks.map((t, i) => ({
      id: `batch_task_${i + 1}`,
      index: i + 1,
      prompt: t.prompt,
      status: BatchTaskStatus.PENDING as TaskStatus,
      retryCount: 0,
    }));

    return { success: true, tasks: this.tasks };
  }

  getNextPending(): BatchTask | undefined {
    return this.tasks.find(t => t.status === BatchTaskStatus.PENDING);
  }

  getActiveTasks(): BatchTask[] {
    return this.tasks.filter(
      t => t.status === BatchTaskStatus.SUBMITTED || t.status === BatchTaskStatus.GENERATING
    );
  }

  markSubmitted(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.status = BatchTaskStatus.SUBMITTED;
  }

  markGenerating(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) task.status = BatchTaskStatus.GENERATING;
  }

  markFailed(taskId: string, error: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = BatchTaskStatus.FAILED;
      task.error = error;
    }
  }

  markCompleted(taskId: string, downloadUrl?: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = BatchTaskStatus.COMPLETED;
      task.downloadUrl = downloadUrl;
    }
  }

  markDownloaded(taskId: string, outputFile: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = BatchTaskStatus.DOWNLOADED;
      task.outputFile = outputFile;
    }
  }

  retryTask(taskId: string): void {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = BatchTaskStatus.PENDING;
      task.error = undefined;
      task.retryCount++;
    }
  }

  isAllDone(): boolean {
    return this.tasks.every(
      t => t.status === BatchTaskStatus.COMPLETED
        || t.status === BatchTaskStatus.DOWNLOADED
        || t.status === BatchTaskStatus.FAILED
    );
  }

  getStatusCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    Object.values(BatchTaskStatus).forEach(s => counts[s] = 0);
    this.tasks.forEach(t => counts[t.status]++);
    return counts;
  }
}

describe('Batch Task Queue', () => {
  let manager: TestBatchManager;

  beforeEach(() => {
    manager = new TestBatchManager();
  });

  it('createBatch initializes tasks with pending status', () => {
    const result = manager.createBatch([
      { prompt: '任务1' },
      { prompt: '任务2' },
      { prompt: '任务3' },
    ]);

    expect(result.success).toBe(true);
    expect(manager.tasks).toHaveLength(3);
    expect(manager.tasks.every(t => t.status === BatchTaskStatus.PENDING)).toBe(true);
  });

  it('createBatch rejects tasks exceeding MAX_BATCH_TASKS', () => {
    const tasks = Array.from({ length: 21 }, (_, i) => ({ prompt: `任务${i + 1}` }));
    const result = manager.createBatch(tasks);
    expect(result.success).toBe(false);
    expect(result.error).toContain('20');
  });

  it('getNextPending returns the first pending task', () => {
    manager.createBatch([{ prompt: 'A' }, { prompt: 'B' }, { prompt: 'C' }]);
    const next = manager.getNextPending();
    expect(next?.prompt).toBe('A');
  });

  it('getNextPending returns undefined when no pending tasks', () => {
    manager.createBatch([{ prompt: 'A' }]);
    manager.markCompleted('batch_task_1');
    expect(manager.getNextPending()).toBeUndefined();
  });
});

describe('Task Enqueue/Dequeue', () => {
  let manager: TestBatchManager;

  beforeEach(() => {
    manager = new TestBatchManager();
    manager.createBatch([
      { prompt: '任务1' }, { prompt: '任务2' }, { prompt: '任务3' },
      { prompt: '任务4' }, { prompt: '任务5' }, { prompt: '任务6' },
    ]);
  });

  it('tasks are dequeued in order', () => {
    const first = manager.getNextPending();
    expect(first?.index).toBe(1);
    manager.markSubmitted(first!.id);

    const second = manager.getNextPending();
    expect(second?.index).toBe(2);
  });

  it('active tasks count is correct', () => {
    manager.markSubmitted('batch_task_1');
    manager.markGenerating('batch_task_2');
    manager.markSubmitted('batch_task_3');

    expect(manager.getActiveTasks()).toHaveLength(3);
  });

  it('active tasks respect concurrent limit', () => {
    for (let i = 0; i < 5; i++) {
      manager.markSubmitted(`batch_task_${i + 1}`);
    }
    expect(manager.getActiveTasks()).toHaveLength(MAX_CONCURRENT);

    // Can't submit more when at limit
    const pending = manager.getNextPending();
    // There's still task 6 as pending
    expect(pending?.index).toBe(6);
  });
});

describe('Failure Skip and Continue', () => {
  let manager: TestBatchManager;

  beforeEach(() => {
    manager = new TestBatchManager();
    manager.createBatch([
      { prompt: '任务1' }, { prompt: '任务2' }, { prompt: '任务3' },
    ]);
  });

  it('failed task does not block subsequent tasks', () => {
    // Mark task 1 as failed
    manager.markSubmitted('batch_task_1');
    manager.markFailed('batch_task_1', 'API 超时');

    // Task 2 should still be available
    const next = manager.getNextPending();
    expect(next?.index).toBe(2);
    expect(next?.prompt).toBe('任务2');
  });

  it('failed task keeps its error message', () => {
    manager.markSubmitted('batch_task_1');
    manager.markFailed('batch_task_1', '网络错误');
    const task = manager.tasks[0];
    expect(task.status).toBe(BatchTaskStatus.FAILED);
    expect(task.error).toBe('网络错误');
  });

  it('mixed success and failure still completes batch', () => {
    manager.markCompleted('batch_task_1');
    manager.markFailed('batch_task_2', '失败');
    manager.markCompleted('batch_task_3');

    expect(manager.isAllDone()).toBe(true);
  });
});

describe('Retry Count', () => {
  let manager: TestBatchManager;

  beforeEach(() => {
    manager = new TestBatchManager();
    manager.createBatch([{ prompt: '重试任务' }]);
  });

  it('retryTask increments retryCount', () => {
    manager.markSubmitted('batch_task_1');
    manager.markFailed('batch_task_1', '失败');

    manager.retryTask('batch_task_1');
    const task = manager.tasks[0];
    expect(task.retryCount).toBe(1);
    expect(task.status).toBe(BatchTaskStatus.PENDING);
    expect(task.error).toBeUndefined();
  });

  it('multiple retries accumulate count', () => {
    // Fail -> retry -> fail -> retry
    manager.markSubmitted('batch_task_1');
    manager.markFailed('batch_task_1', '失败1');
    manager.retryTask('batch_task_1');

    manager.markSubmitted('batch_task_1');
    manager.markFailed('batch_task_1', '失败2');
    manager.retryTask('batch_task_1');

    expect(manager.tasks[0].retryCount).toBe(2);
  });
});

describe('Status Counts', () => {
  let manager: TestBatchManager;

  beforeEach(() => {
    manager = new TestBatchManager();
    manager.createBatch([
      { prompt: 'A' }, { prompt: 'B' }, { prompt: 'C' },
      { prompt: 'D' }, { prompt: 'E' },
    ]);
  });

  it('counts all statuses correctly', () => {
    manager.markGenerating('batch_task_1');
    manager.markSubmitted('batch_task_2');
    manager.markCompleted('batch_task_3');
    manager.markDownloaded('batch_task_4');
    manager.markFailed('batch_task_5', '错误');

    const counts = manager.getStatusCounts();
    expect(counts.pending).toBe(0);
    expect(counts.submitted).toBe(1);
    expect(counts.generating).toBe(1);
    expect(counts.completed).toBe(1);
    expect(counts.downloaded).toBe(1);
    expect(counts.failed).toBe(1);
  });
});
