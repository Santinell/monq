var Job = require('./job');

module.exports = Queue;

function Queue(model, name, options) {
  if (typeof name === 'object' && options === undefined) {
    options = name;
    name = undefined;
  }

  options = options || {};
  this.Model = model;

  this.name = name || 'default';
  this.options = options;
}

Queue.prototype.job = function (task) {
  return new Job(task);
};

Queue.prototype.newJob = function (data) {
  return new Job(new this.Model(data));
};

Queue.prototype.get = function (id, callback) {
  var self = this;

  this.Model.findOne({_id: id, queue: this.name}, function (err, task) {
    if (err) {
      return callback(err);
    }

    callback(null, self.job(task));
  });
};

Queue.prototype.enqueue = function (name, params, options, callback) {
  if (!callback && typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!callback && !options) {
    callback = function () {};
    options = {};
  }

  var job = this.newJob({
    name: name,
    params: params,
    queue: this.name,
    attempts: parseAttempts(options.attempts),
    timeout: parseTimeout(options.timeout),
    delay: options.delay,
    paused: options.paused,
    priority: options.priority
  });

  job.enqueue(callback);
};

Queue.prototype.unpause = function (query, callback) {
  query = query || {};
  query.status = Job.PAUSED;
  const update = {$set: {status: Job.QUEUED}};
  this.Model.update(query, update, {multi: true}, callback);
};

Queue.prototype.dequeue = function (options, callback) {
  var self = this;

  if (callback === undefined) {
    callback = options;
    options = {};
  }

  var query = {
    status: Job.QUEUED,
    queue: this.name,
    delay: {
      $lte: new Date()
    }
  };

  if (options.minPriority !== undefined) {
    query.priority = {$gte: options.minPriority};
  }

  if (options.callbacks !== undefined) {
    var callbackNames = Object.keys(options.callbacks);
    query.name = {$in: callbackNames};
  }

  var opts = {new: true, sort: {priority: -1, _id: 1}};
  var update = {
    $set: {
      status: Job.DEQUEUED,
      dequeued: new Date()
    }
  };

  this.Model.findOneAndUpdate(query, update, opts, function (err, doc) {
    if (err) {
      return callback(err);
    }
    if (!doc) {
      return callback();
    }

    callback(null, self.job(doc));
  });
};

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

  var result = {count: parseInt(attempts.count, 10)};

  if (attempts.delay !== undefined) {
    result.delay = parseInt(attempts.delay, 10);
    result.strategy = attempts.strategy;
  }

  return result;
}
