const EventEmitter = require('events').EventEmitter;

class Worker extends EventEmitter {
  constructor(name, queues, options) {
    super();
    this.name = name;
    options = options || {};

    this.queues = queues || {};
    this.additionalQuery = options.additionalQuery || null;
    this.interval = options.interval || 3000;
    this.maxPerQueue = options.maxPerQueue || 1;

    this.callbacks = options.callbacks || {};
    this.validation = options.validation || (async () => true);

    // This worker will only process jobs of this priority or higher
    this.minPriority = options.minPriority;
    this.timers = {};
    this.counter = {};
  }

  register(callbacks) {
    for (const name in callbacks) {
      if (callbacks.hasOwnProperty(name)) {
        this.callbacks[name] = callbacks[name];
      }
    }
  }

  start() {
    this.working = true;
    if (Object.keys(this.queues).length !== 0) {
      for (const queueName in this.queues) {
        if (this.queues.hasOwnProperty(queueName)) {
          this.startPolling(queueName);
        }
      }
    }
  }

  startPolling(queueName) {
    this.timers[queueName] = setInterval(async () => {
      if (!this.counter[queueName]) {
        this.counter[queueName] = 0;
      }
      if (this.counter[queueName] < this.maxPerQueue) {
        await this.poll(queueName);
      }
    }, this.interval);
  }

  incCounter(queueName, amt) {
    if (!amt) {
      amt = 1;
    }
    if (!this.counter[queueName]) {
      this.counter[queueName] = 0;
    }
    this.counter[queueName] += amt;
  }

  async poll(queueName) {
    if (!this.working) {
      return this.emit('stopped');
    }
    let query = null;
    if (this.additionalQuery) {
      query = await this.additionalQuery();
    }

    let job;
    try {
      job = await this.queues[queueName].dequeue(this.name, {
        minPriority: this.minPriority,
        query: query,
        callbacks: this.callbacks
      });
    } catch (err) {
      return this.emit('error', {
        queue: queueName,
        job: job.data,
        error: err
      });
    }

    if (job) {
      const res = await this.validation(queueName, job);
      if (!res) {
        await job.back();
        return;
      }
      this.incCounter(queueName);
      this.emit('dequeued', {queue: queueName, job: job.data});
      await this.work(queueName, job);
    }
    this.emit('empty', {queue: queueName});
  }

  addQueue(name, queue) {
    if (typeof name !== 'string' || typeof queue !== 'object') {
      throw new Error('Wrong params');
    }
    this.queues[name] = queue;
    this.startPolling(name);
  }

  getQueue(name) {
    return this.queues[name];
  }

  dropQueue(name) {
    if (this.timers[name]) {
      clearInterval(this.timers[name]);
      delete this.timers[name];
    }
    if (this.queues[name]) {
      delete this.queues[name];
    }
  }

  async work(queueName, job) {
    let result;
    try {
      result = await this.process(job.data);
      await job.complete(result);
      this.emit('complete', {queue: queueName, job: job.data});
    } catch (err) {
      await job.fail(err);
      this.emit('failed', {queue: queueName, job: job.data});
    } finally {
      this.incCounter(queueName, -1);
      this.emit('done', {queue: queueName, job: job.data});
    }
  }

  async process(data) {
    const func = this.callbacks[data.name];
    if (func) {
      return func(data);
    }
    throw new Error('No callback registered for `' + data.name + '`');
  }
}

module.exports = Worker;
