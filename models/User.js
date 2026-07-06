const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true },
  email: { 
    type: String, 
    required: true,
    unique: true,
    trim: true, 
    lowercase: true 
    },
  password: { 
    type: String, 
    required: true
   },
  avatar: { 
    type: String, 
    default: '' 
  },
  isOnline: { 
    type: Boolean, 
    default: false 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);