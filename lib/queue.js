const Job = require('./job');

class Queue {
  constructor(model, name, options) {
    if (typeof name === 'object' && options === undefined) {
      options = name;
      name = undefined;
    }

    options = options || {};
    this.Model = model;

    this.name = name || 'default';
    this.options = options;
  }

  job(task) {
    return new Job(task);
  }

  newJob(data) {
    return new Job(new this.Model(data));
  }

  async get(id) {
    const task = await this.Model.findOne({_id: id, queue: this.name});
    return this.job(task);
  }

  async enqueue(name, params, options = {}) {
    const job = this.newJob({
      name: name,
      params: params,
      queue: this.name,
      attempts: parseAttempts(options.attempts),
      timeout: parseTimeout(options.timeout),
      delay: options.delay,
      priority: options.priority,
      status: options.paused ? Job.PAUSED : Job.QUEUED
    });

    return job.enqueue();
  }

  async unpause(query = {}) {
    query.status = Job.PAUSED;
    const update = {$set: {status: Job.QUEUED}};
    return this.Model.update(query, update, {multi: true});
  }

  async dequeue(worker, options = {}) {
    let query = {
      status: Job.QUEUED,
      queue: this.name,
      delay: {
        $lte: new Date()
      }
    };

    if (options.query) {
      query = Object.assign(query, options.query);
    }

    if (options.minPriority !== undefined) {
      query.priority = {$gte: options.minPriority};
    }

    if (options.callbacks !== undefined) {
      const callbackNames = Object.keys(options.callbacks);
      query.name = {$in: callbackNames};
    }

    const opts = {new: true, sort: {priority: -1, _id: 1}};
    const update = {
      $set: {
        worker,
        status: Job.DEQUEUED,
        dequeued: new Date()
      }
    };

    const doc = await this.Model.findOneAndUpdate(query, update, opts);
    if (!doc) {
      return false;
    }

    return this.job(doc);
  }
}

module.exports = Queue;
// Helpers

function parseTimeout(timeout) {
  if (timeout === undefined) {
    return undefined;
  }
  return parseInt(timeout, 10);
}

function parseAttempts(attempts) {
  if (attempts === undefined) {
    return undefined;
  }

  if (typeof attempts !== 'object') {
    throw new Error('attempts must be an object');
  }

  const result = {count: parseInt(attempts.count, 10)};

  if (attempts.delay !== undefined) {
    result.delay = parseInt(attempts.delay, 10);
    result.strategy = attempts.strategy;
  }

  return result;
}
