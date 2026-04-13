const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST api/auth/signup
router.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        if (!email.endsWith('@gmail.com')) {
            return res.status(400).json({ msg: 'Email must end with @gmail.com' });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });

        user = new User({ username, email, password });
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) return res.status(500).json({ msg: 'Server Error' });
            res.json({ token, user: payload.user });
        });
    } catch (err) {
        console.error("Signup Error:", err.message);
        res.status(500).json({ msg: 'Signup Failed', error: err.message });
    }
});

// @route   POST api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Handle admin login specifically as requested
        if (email === 'admin@gmail.com' && password === 'admin123') {
            const payload = { user: { id: 'admin_id', username: 'Administrator', role: 'admin' } };
            return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
                if (err) {
                    console.error("JWT Sign error:", err);
                    return res.status(500).json({ msg: 'Server Error' });
                }
                res.json({ token, user: payload.user });
            });
        }

        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

        const payload = { user: { id: user.id, username: user.username, role: user.role } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 360000 }, (err, token) => {
            if (err) return res.status(500).json({ msg: 'Server Error' });
            res.json({ token, user: payload.user });
        });
    } catch (err) {
        console.error("CATCH BLOCK ERROR:", err);
        res.status(500).json({ error: String(err), stack: err.stack });
    }
});

module.exports = router;
