const Queue = require('./queue');
const Worker = require('./worker');
const getModel = require('./model');

module.exports = (connection) => {
  return {
    models: [],
    worker(name, queueNames, options) {
      queueNames = queueNames || [];

      if (!Array.isArray(queueNames)) {
        queueNames = [queueNames];
      }
      const queues = queueNames.reduce((acc, name) => {
        acc[name] = this.queue(name);
        return acc;
      }, {});

      return new Worker(name, queues, options);
    },

    queue(name, options) {
      options = options || {};
      const modelName = options.modelName || 'Job';
      if (!this.models[modelName]) {
        this.models[modelName] = getModel(connection, modelName);
      }
      return new Queue(this.models[modelName], name, options);
    }

  };
};
