'use strict';
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { ADMIN_MOBILE } = require('../config/admin');

async function signup(req, res) {
  const { name, mobile, password } = req.body;
  if (!name || !mobile || !password) return res.json({ msg: 'All fields required' });

  const exists = await User.findOne({ mobile });
  if (exists) return res.json({ msg: 'Already registered' });

  const hashedPassword = await bcrypt.hash(password, 10);

  await User.create({ name, mobile, password: hashedPassword });
  res.json({ msg: 'Signup done. Wait for admin approval' });
}

async function login(req, res) {
  const { mobile, password } = req.body;
  
  if (mobile === ADMIN_MOBILE) {
    if (password !== 'admin123') return res.json({ msg: 'Invalid password' });
    return res.json({ role: 'admin' });
  }

  const user = await User.findOne({ mobile });
  if (!user) return res.json({ msg: 'Signup first' });
  if (!user.approved) return res.json({ msg: 'Waiting for approval' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.json({ msg: 'Invalid password' });

  res.json({ role: user.role });
}

module.exports = { signup, login };
