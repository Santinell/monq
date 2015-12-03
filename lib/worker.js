var events = require('events');
var util = require('util');
var Queue = require('./queue');

module.exports = Worker;

function Worker(queues, options) {
    options || (options = {});

    this.queues = queues || {};
    this.interval = options.interval || 5000;

    this.callbacks = options.callbacks || {};
    this.strategies = options.strategies || {};

    // Default retry strategies
    this.strategies.linear || (this.strategies.linear = linear);
    this.strategies.exponential || (this.strategies.exponential = exponential);

    // This worker will only process jobs of this priority or higher
    this.minPriority = options.minPriority;

}

util.inherits(Worker, events.EventEmitter);

Worker.prototype.register = function (callbacks) {
    for (var name in callbacks) {
        this.callbacks[name] = callbacks[name];
    }
};

Worker.prototype.strategies = function (strategies) {
    for (var name in strategies) {
        this.strategies[name] = strategies[name];
    }
};

Worker.prototype.start = function () {
    this.working = true;
    if (Object.keys(this.queues).length !== 0) {
        for (var name in this.queues) {
          if (this.queues.hasOwnProperty(name)) {
            this.poll(name);
          }
        }
    }
};

Worker.prototype.stop = function (callback) {
    var self = this;

    function done() {
        if (callback) callback();
    }

    if (!this.working) done();
    this.working = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
      return done();
    }

    this.once('stopped', done);
};

Worker.prototype.poll = function (queueName) {
    if (!this.working) {
        return this.emit('stopped');
    }

    var self = this;

    this.queues[queueName].dequeue({
      minPriority: this.minPriority,
      callbacks: this.callbacks
    }, function (err, job) {
        if (err) return self.emit('error', err);

        if (job) {
            self.emit('dequeued', {queue: queueName, job: job.data});
            self.work(queueName, job);
        } else {
            self.emit('empty', {queue: queueName});
            //Queue is empty - wait
            setTimeout(function () {
                self.poll(queueName);
            }, self.interval);

        }
    });
};

Worker.prototype.addQueue = function (name, queue) {
    if (typeof name !== "string" || typeof queue !== "object")
        throw new Error("Wrong params");
    this.queues[name] = queue;
    this.poll(name);
};

Worker.prototype.getQueue = function (name) {
    return this.queues[name];
};

Worker.prototype.work = function (queueName, job) {
    var self = this;
    var finished = false;

    if (job.data.timeout) {
        var timer = setTimeout(function () {
            done(new Error('timeout'));
        }, job.data.timeout);
    }

    function done(err, result) {
        // It's possible that this could be called twice in the case that a job times out,
        // but the handler ends up finishing later on
        if (finished) {
            console.log("twice");
            return;
        } else {
            finished = true;
        }

        clearTimeout(timer);
        self.emit('done', {queue: queueName, job: job.data});

        if (err) {
            self.error(job, err, function (err) {
                if (err) return self.emit('error', {queue: queueName, job: job.data, error: err});

                self.emit('failed', {queue: queueName, job: job.data});
                self.poll(queueName);
            });
        } else {
            job.complete(result, function (err) {
                if (err) return self.emit('error', {queue: queueName, job: job.data, error: err});

                self.emit('complete', {queue: queueName, job: job.data});
                self.poll(queueName);
            });
        }
    };

    this.process(job.data, done);
};

Worker.prototype.process = function (data, callback) {
    var func = this.callbacks[data.name];

    if (!func) {
        callback(new Error('No callback registered for `' + data.name + '`'));
    } else {
        func(data.params, callback);
    }
};

Worker.prototype.error = function (job, err, callback) {
    var attempts = job.data.attempts;
    var remaining = 0;

    if (attempts) {
        remaining = attempts.remaining = (attempts.remaining || attempts.count) - 1;
    }

    if (remaining > 0) {
        var strategy = this.strategies[attempts.strategy || 'linear'];
        if (!strategy) {
            strategy = linear;

            console.error('No such retry strategy: `' + attempts.strategy + '`');
            console.error('Using linear strategy');
        }

        if (attempts.delay !== undefined) {
            var wait = strategy(attempts);
        } else {
            var wait = 0;
        }

        job.delay(wait, callback)
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
