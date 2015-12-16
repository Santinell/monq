module.exports = Job;

function Job(task) {
  this.task = task;
}

Job.PAUSED = 'paused';
Job.QUEUED = 'queued';
Job.DEQUEUED = 'dequeued';
Job.COMPLETE = 'complete';
Job.FAILED = 'failed';
Job.CANCELLED = 'cancelled';

Job.prototype.cancel = function (callback) {
  if (this.task.status !== Job.QUEUED && this.task.status !== Job.PAUSED) {
    return callback(new Error('Only queued or paused jobs may be cancelled'));
  }

  this.task.status = Job.CANCELLED;
  this.task.ended = new Date();

  this.task.save(callback);
};

Job.prototype.complete = function (result, callback) {
  this.task.status = Job.COMPLETE;
  this.task.ended = new Date();
  this.task.result = result;

  this.task.save(callback);
};

Job.prototype.fail = function (err, callback) {
  this.task.status = Job.FAILED;
  this.task.ended = new Date();
  this.task.error = err.message;
  this.task.stack = err.stack;

  this.task.save(callback);
};

Job.prototype.enqueue = function (callback) {
  if (this.task.delay === undefined) {
    this.task.delay = new Date();
  }

  if (this.task.priority === undefined) {
    this.task.priority = 0;
  }

  if (this.task.paused) {
    this.task.status = Job.PAUSED;
  } else {
    this.task.status = Job.QUEUED;
  }

  this.task.enqueued = new Date();

  this.task.save(callback);
};

Job.prototype.delay = function (delay, callback) {
  this.task.delay = new Date(new Date().getTime() + delay);

  this.enqueue(callback);
};
