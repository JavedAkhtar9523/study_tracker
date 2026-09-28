const jwt = require("jsonwebtoken");

// Verifies the login token and attaches { role } to req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Login required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { role: 'manager' | 'student' }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired, please login again" });
  }
}

// Restricts a route to the manager only
function requireManager(req, res, next) {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ message: "Only the manager can do this" });
  }
  next();
}

module.exports = { requireAuth, requireManager };
