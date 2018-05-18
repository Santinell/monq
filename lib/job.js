
class Job {
  static get PAUSED() {
    return 'paused';
  }

  static get QUEUED() {
    return 'queued';
  }

  static get DEQUEUED() {
    return 'dequeued';
  }

  static get COMPLETE() {
    return 'complete';
  }

  static get FAILED() {
    return 'failed';
  }

  static get CANCELLED() {
    return 'cancelled';
  }

  constructor(data) {
    this.data = data;
  }

  async cancel() {
    if (this.data.status !== Job.QUEUED && this.data.status !== Job.PAUSED) {
      throw new Error('Only queued or paused jobs may be cancelled');
    }

    this.data.status = Job.CANCELLED;
    this.data.ended = new Date();

    await this.data.save();
  }

  async complete(result) {
    this.data.status = Job.COMPLETE;
    this.data.ended = new Date();
    this.data.result = result;

    await this.data.save();
  }

  async fail(err) {
    this.data.status = Job.FAILED;
    this.data.ended = new Date();
    this.data.error = err.message;
    this.data.stack = err.stack;

    await this.data.save();
  }

  async enqueue() {
    if (this.data.delay === undefined) {
      this.data.delay = new Date();
    }

    if (this.data.priority === undefined) {
      this.data.priority = 0;
    }

    this.data.enqueued = new Date();

    await this.data.save();
  }

  async back() {
    this.data.status = Job.QUEUED;
    this.data.dequeued = undefined;
    await this.data.save();
  }

  async delay(delay) {
    this.data.delay = new Date(new Date().getTime() + delay);
    this.data.status = Job.QUEUED;

    await this.enqueue();
  }
}

module.exports = Job;
