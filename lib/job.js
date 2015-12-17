module.exports = Job;

function Job(data) {
  this.data = data;
}

Job.PAUSED = 'paused';
Job.QUEUED = 'queued';
Job.DEQUEUED = 'dequeued';
Job.COMPLETE = 'complete';
Job.FAILED = 'failed';
Job.CANCELLED = 'cancelled';

Job.prototype.cancel = function (callback) {
  if (this.data.status !== Job.QUEUED && this.data.status !== Job.PAUSED) {
    return callback(new Error('Only queued or paused jobs may be cancelled'));
  }

  this.data.status = Job.CANCELLED;
  this.data.ended = new Date();

  this.data.save(callback);
};

Job.prototype.complete = function (result, callback) {
  this.data.status = Job.COMPLETE;
  this.data.ended = new Date();
  this.data.result = result;

  this.data.save(callback);
};

Job.prototype.fail = function (err, callback) {
  this.data.status = Job.FAILED;
  this.data.ended = new Date();
  this.data.error = err.message;
  this.data.stack = err.stack;

  this.data.save(callback);
};

Job.prototype.enqueue = function (callback) {
  if (this.data.delay === undefined) {
    this.data.delay = new Date();
  }

  if (this.data.priority === undefined) {
    this.data.priority = 0;
  }

  if (this.data.paused) {
    this.data.status = Job.PAUSED;
  } else {
    this.data.status = Job.QUEUED;
  }

  this.data.enqueued = new Date();

  this.data.save(callback);
};

Job.prototype.delay = function (delay, callback) {
  this.data.delay = new Date(new Date().getTime() + delay);

  this.enqueue(callback);
};
