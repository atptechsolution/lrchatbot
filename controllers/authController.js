'use strict';
const User = require('../models/User');
const { ADMIN_MOBILE } = require('../config/admin');

async function signup(req, res) {
  const { name, mobile } = req.body;
  if (!name || !mobile) return res.json({ msg: 'All fields required' });

  const exists = await User.findOne({ mobile });
  if (exists) return res.json({ msg: 'Already registered' });

  await User.create({ name, mobile });
  res.json({ msg: 'Signup done. Wait for admin approval' });
}

async function login(req, res) {
  const { mobile } = req.body;
  if (mobile === ADMIN_MOBILE) return res.json({ role: 'admin' });

  const user = await User.findOne({ mobile });
  if (!user) return res.json({ msg: 'Signup first' });
  if (!user.approved) return res.json({ msg: 'Waiting for approval' });

  res.json({ role: 'user' });
}

module.exports = { signup, login };
