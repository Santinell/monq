const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Mixed = Schema.Types.Mixed;

module.exports = function (connection, modelName) {
  let jobModel;
  try {
    jobModel = connection.model(modelName);
  } catch (ex) {
    if (ex.name === 'MissingSchemaError') {
      const jobSchema = new Schema({
        name: {
          type: String,
          required: true
        },
        worker: {
          type: String
        },
        params: {},
        queue: {
          type: String,
          required: true
        },
        attempts: {
          type: Mixed,
          default: null
        },
        timeout: {
          type: Number,
          default: null
        },
        delay: Date,
        priority: Number,
        status: {
          type: String,
          required: true
        },
        enqueued: {
          type: Date,
          required: true
        },
        dequeued: Date,
        ended: Date,
        error: String,
        stack: String,
        result: Mixed
      });

      jobSchema.index({
        status: 1,
        queue: 1,
        priority: 1,
        _id: 1,
        delay: 1
      });

      jobModel = connection.model(modelName, jobSchema);
    } else {
      throw ex;
    }
  }

  return jobModel;
};
