const events = require('events');
const util = require('util');

module.exports = Worker;

function Worker(queues, options) {
  options = options || {};

  this.queues = queues || {};
  this.additionalQuery = options.additionalQuery || null;
  this.interval = options.interval || 3000;
  this.maxPerQueue = options.maxPerQueue || 1;

  this.callbacks = options.callbacks || {};
  this.strategies = options.strategies || {};
  this.validation = options.validation || (async () => true);

  // Default retry strategies
  this.strategies.linear = this.strategies.linear || linear;
  this.strategies.exponential = this.strategies.exponential || exponential;

  // This worker will only process jobs of this priority or higher
  this.minPriority = options.minPriority;
  this.timers = {};
  this.counter = {};
}

util.inherits(Worker, events.EventEmitter);

Worker.prototype.register = function (callbacks) {
  for (const name in callbacks) {
    if (callbacks.hasOwnProperty(name)) {
      this.callbacks[name] = callbacks[name];
    }
  }
};

Worker.prototype.strategies = function (strategies) {
  for (const name in strategies) {
    if (strategies.hasOwnProperty(name)) {
      this.strategies[name] = strategies[name];
    }
  }
};

Worker.prototype.start = function () {
  this.working = true;
  if (Object.keys(this.queues).length !== 0) {
    for (const queueName in this.queues) {
      if (this.queues.hasOwnProperty(queueName)) {
        this.startPolling(queueName);
      }
    }
  }
};

Worker.prototype.startPolling = function (queueName) {
  this.timers[queueName] = setInterval(async () => {
    if (!this.counter[queueName]) {
      this.counter[queueName] = 0;
    }
    if (this.counter[queueName] < this.maxPerQueue) {
      await this.poll(queueName);
    }
  }, this.interval);
};

Worker.prototype.incCounter = function (queueName, amt) {
  if (!amt) {
    amt = 1;
  }
  if (!this.counter[queueName]) {
    this.counter[queueName] = 0;
  }
  this.counter[queueName] += amt;
};

Worker.prototype.stop = function (callback) {
  function done() {
    if (callback) {
      callback();
    }
  }

  if (!this.working) {
    done();
  }
  this.working = false;

  const tCnt = Object.keys(this.timers).length;
  if (tCnt > 0) {
    for (const name in this.timers) {
      if (this.timers.hasOwnProperty(name)) {
        clearInterval(this.timers[name]);
      }
    }
    const qCnt = Object.keys(this.queues).length;
    if (tCnt === qCnt) {
      return done();
    }
  }

  this.once('stopped', done);
};

Worker.prototype.poll = async (queueName) => {
  if (!this.working) {
    return this.emit('stopped');
  }
  const self = this;
  let query = null;
  if (this.additionalQuery) {
    query = await this.additionalQuery();
  }

  let job;
  try {
    job = await this.queues[queueName].dequeue({
      minPriority: this.minPriority,
      query: query,
      callbacks: this.callbacks
    });
  } catch (err) {
    return self.emit('error', {
      queue: queueName,
      job: job.data,
      error: err
    });
  }

  if (job) {
    const res = await self.validation(queueName, job);
    if (!res) {
      job.delay(0);
      return;
    }
    self.incCounter(queueName);
    self.emit('dequeued', {queue: queueName, job: job.data});
    self.work(queueName, job);
  } else {
    self.emit('empty', {queue: queueName});
  }
};

Worker.prototype.addQueue = function (name, queue) {
  if (typeof name !== 'string' || typeof queue !== 'object') {
    throw new Error('Wrong params');
  }
  this.queues[name] = queue;
  this.startPolling(name);
};

Worker.prototype.getQueue = function (name) {
  return this.queues[name];
};

Worker.prototype.dropQueue = function (name) {
  if (this.timers[name]) {
    clearInterval(this.timers[name]);
    delete this.timers[name];
  }
  if (this.queues[name]) {
    delete this.queues[name];
  }
};

Worker.prototype.work = function (queueName, job) {
  const self = this;
  let finished = false;
  let timer;

  if (job.data.timeout) {
    timer = setTimeout(() => {
      done(new Error('timeout'));
    }, job.data.timeout);
  }

  function done(err, result) {
    // It's possible that this could be called twice in the case that a job times out,
    // but the handler ends up finishing later on
    if (finished) {
      console.log(queueName, 'twice');
      return;
    }
    finished = true;
    self.incCounter(queueName, -1);

    clearTimeout(timer);
    self.emit('done', {queue: queueName, job: job.data});
    result = result || '';

    if (err) {
      self.error(job, err, (err) => {
        if (err) {
          return self.emit('error', {
            queue: queueName,
            job: job.data,
            error: err
          });
        }

        self.emit('failed', {queue: queueName, job: job.data});
      });
    } else {
      job.complete(result, (err) => {
        if (err) {
          return self.emit('error', {
            queue: queueName,
            job: job.data,
            error: err
          });
        }

        self.emit('complete', {queue: queueName, job: job.data});
      });
    }
  }

  this.process(job.data, done);
};

Worker.prototype.process = function (data, callback) {
  const func = this.callbacks[data.name];

  if (func) {
    func(data).then(res => {
      callback(null, res);
    }).catch(callback);
  } else {
    callback(new Error('No callback registered for `' + data.name + '`'));
  }
};

Worker.prototype.error = function (job, err, callback) {
  const attempts = job.data.attempts;
  let remaining = 0;
  let wait;

  if (attempts) {
    remaining = attempts.remaining = (attempts.remaining || attempts.count) - 1;
  }

  if (remaining > 0) {
    let strategy = this.strategies[attempts.strategy || 'linear'];
    if (!strategy) {
      strategy = linear;

      console.error('No such retry strategy: `' + attempts.strategy + '`');
      console.error('Using linear strategy');
    }

    if (attempts.delay === undefined) {
      wait = 0;
    } else {
      wait = strategy(attempts);
    }

    job.delay(wait, callback);
  } else {
    job.fail(err, callback);
  }
};

// Strategies
// ---------------

function linear(attempts) {
  return attempts.delay;
}

function exponential(attempts) {
  return attempts.delay * (attempts.count - attempts.remaining);
}
