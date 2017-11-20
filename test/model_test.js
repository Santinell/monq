/* eslint-env node, mocha */
const should = require('chai').should();
const mongoose = require('mongoose');
mongoose.Promise = Promise;
const getModel = require('../lib/model');
const mongoHost = process.env.MONGO_HOST || '127.0.0.1';
let connection;
let JobModel;

before((done) => {
  connection = mongoose.createConnection(`mongodb://${mongoHost}/monq_test`);
  connection.on('error', console.error.bind(console));
  connection.once('open', () => {
    JobModel = getModel(connection, 'Job');
    done();
  });
});

after((done) => {
  connection.db.dropDatabase((err) => {
    if (err) {
      return done(err);
    }
    connection.close(done);
  });
});

afterEach((done) => {
  JobModel.collection.drop(() => {
    delete connection.models.Job;
    done();
  });
});

describe('JobModel', () => {
  it('should have some props', () => {
    JobModel.should.have.property('collection');
    JobModel.should.have.property('schema');
    JobModel.should.have.property('db');
    JobModel.should.have.property('model');
    JobModel.should.have.property('modelName');
    JobModel.should.have.property('base');
  });

  it('should sucess create record', (done) => {
    const job = new JobModel({
      queue: 'queue',
      name: 'test',
      status: 'queued',
      enqueued: new Date()
    });

    job.save(assert);

    function assert(err, result) {
      should.not.exist(err);
      result.should.have.property('queue', 'queue');
      result.should.have.property('name', 'test');
      done();
    }
  });
});
