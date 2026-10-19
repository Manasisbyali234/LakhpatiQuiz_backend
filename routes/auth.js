const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { wrap, httpError } = require('../utils/helpers');

const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post(
  '/register',
  wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (name.length < 2) throw httpError(400, 'Please enter your name');
    if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Please enter a valid email');
    if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
    if (await User.findOne({ email })) throw httpError(409, 'An account with this email already exists');

    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw httpError(401, 'Incorrect email or password');
    res.json({ token: sign(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  auth,
  wrap(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw httpError(401, 'Account not found');
    res.json({ user: publicUser(user) });
  })
);

module.exports = router;
