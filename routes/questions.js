const router = require('express').Router();
const Question = require('../models/Question');
const { auth } = require('../middleware/auth');
const { wrap, validateQuestion, httpError } = require('../utils/helpers');

// Logged-in users can suggest a question; it stays "pending" until an admin approves it.
router.post(
  '/submit',
  auth,
  wrap(async (req, res) => {
    const { error, data } = validateQuestion(req.body);
    if (error) throw httpError(400, error);
    const q = await Question.create({ ...data, status: 'pending', createdBy: req.user.id });
    res.status(201).json({ message: 'Thanks! Your question was sent for review.', question: q });
  })
);

router.get(
  '/mine',
  auth,
  wrap(async (req, res) => {
    const items = await Question.find({ createdBy: req.user.id }).sort('-createdAt').limit(100);
    res.json({ items });
  })
);

module.exports = router;
