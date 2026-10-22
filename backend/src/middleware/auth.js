const jwt = require('jsonwebtoken');
const ROLES = require('../config/roles');

// checks if user is logged in (valid token in Authorization header)
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Please login first' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, role }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid, please login again' });
  }
}

// checks if logged in user has one of the allowed roles
// example: authorize(ROLES.TEACHER) or authorize(ROLES.ADMIN, ROLES.TEACHER)
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Please login first' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to do this' });
    }
    next();
  };
}

// students can only see their own data (like attempt history)
// teacher and admin can see any student's data
// route must have :studentId in it
function onlyOwnData(req, res, next) {
  if (req.user.role === ROLES.STUDENT && String(req.user.id) !== String(req.params.studentId)) {
    return res.status(403).json({ message: 'You can only view your own data' });
  }
  next();
}

module.exports = { authenticate, authorize, onlyOwnData };
