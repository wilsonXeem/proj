const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const adminSchema = new Schema({
  adminEmail: {
    type: String,
    required: true,
    unique: true
  },
  adminPassword: {
    type: String,
    required: true
  },
  permissions: {
    type: [String],
    default: ['view_users', 'inject_cookies', 'manage_users']
  },
  lastLogin: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Admin", adminSchema);