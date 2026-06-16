const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

async function registerUser(req, res) {
    const { name, email, password, role = 'candidate' } = req.body;

    // check if email already taken
    const isUserAlreadyExist = await userModel.findOne({ email });

    if (isUserAlreadyExist) {
        return res.status(409).json({
            message: 'Email already exists'
        });
    }

    // never store plain text password lol
    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
        name,
        email,
        password: hash,
        role
    });

    const token = jwt.sign({
        id: user._id,
        role: user.role,
    }, process.env.JWT_SECRET);

    res.cookie('token', token);

    res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
}

async function loginUser(req, res) {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
        return res.status(401).json({
            message: 'Invalid credentials'
        });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return res.status(401).json({
            message: 'Incorrect password, try again!'
        });
    }

    const token = jwt.sign({
        id: user._id,
        role: user.role,
    }, process.env.JWT_SECRET);

    res.cookie('token', token);

    res.status(200).json({
        message: 'User logged in successfully',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
}

async function logoutUser(req, res) {
    res.clearCookie('token');
    res.status(200).json({
        message: 'User logged out successfully'
    });
}

module.exports = { registerUser, loginUser, logoutUser };
