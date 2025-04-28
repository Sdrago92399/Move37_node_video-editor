require('dotenv').config();

const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) {
        req.user = null;
        next();
    } else {
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to authenticate token' });
            } else {
                req.user = decoded;
                next();
            }
        });
    }
};
