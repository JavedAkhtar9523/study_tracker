const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

// POST /api/auth/login  { pin }
// Compares the entered PIN against the two PINs in .env and issues a token.
router.post("/login", (req, res) => {
  const { pin } = req.body;

  if (!pin) {
    return res.status(400).json({ message: "Enter your PIN" });
  }

  let role = null;
  if (pin === process.env.MANAGER_PIN) role = "manager";
  else if (pin === process.env.STUDENT_PIN) role = "student";

  if (!role) {
    return res.status(401).json({ message: "Wrong PIN, try again" });
  }

  const token = jwt.sign({ role }, process.env.JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, role });
});

module.exports = router;
