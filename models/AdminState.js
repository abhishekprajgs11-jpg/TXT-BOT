const mongoose = require('mongoose');

const adminStateSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    unique: true
  },
  step: {
    type: String, 
    required: true,
  },
  format: {
    type: String, // 'OLD FORMATE', 'NEW FORMATE'
    default: null
  },
  fileId: {
    type: String,
    default: null
  },
  coaching: {
    type: String,
    default: null
  },
  year: {
    type: String,
    default: null
  },
  testCode: {
    type: String,
    default: null
  },
  operation: {
    type: String, // 'ADD', 'DEL', 'EDIT', 'BULK'
    default: 'ADD'
  },
  targetType: {
    type: String, // 'YEAR', 'COACHING', 'TEST'
    default: null
  },
  oldName: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('AdminState', adminStateSchema);
