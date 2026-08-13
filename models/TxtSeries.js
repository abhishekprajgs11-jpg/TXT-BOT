const mongoose = require('mongoose');

const txtSeriesSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
  },
  coaching: {
    type: String,
    required: true,
  },
  testCode: {
    type: String,
    required: true,
  },
  format: {
    type: String, // 'OLD FORMATE' or 'NEW FORMATE'
    required: true,
  },
  fileId: {
    type: String,
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('TxtSeries', txtSeriesSchema);
