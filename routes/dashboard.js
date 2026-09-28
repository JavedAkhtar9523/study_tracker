const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Topic = require("../models/Topic");
const Subject = require("../models/Subject");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// GET /api/dashboard/summary
// Returns everything the manager dashboard needs in one call.
router.get("/summary", async (req, res) => {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  // ---- Today's tasks & completion ----
  const todayTasks = await Task.find({ date: { $gte: todayStart, $lte: todayEnd } })
    .populate("subject")
    .populate("topic");

  const todayCompleted = todayTasks.filter((t) => t.status === "completed").length;
  const todayCompletionPct = todayTasks.length
    ? Math.round((todayCompleted / todayTasks.length) * 100)
    : null; // null means no tasks were assigned today at all

  // ---- Weekly hours (last 7 days including today) ----
  const weekStart = startOfDay(new Date());
  weekStart.setDate(weekStart.getDate() - 6);
  const weekTasks = await Task.find({ date: { $gte: weekStart, $lte: todayEnd } });
  const weeklyMinutes = weekTasks.reduce((sum, t) => sum + (t.actualDurationMinutes || 0), 0);

  // Daily breakdown for the last 7 days (for a bar chart)
  const dailyBreakdown = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);
    const dayTasks = weekTasks.filter((t) => t.date >= dStart && t.date <= dEnd);
    const minutes = dayTasks.reduce((s, t) => s + (t.actualDurationMinutes || 0), 0);
    dailyBreakdown.push({
      date: dStart.toISOString().slice(0, 10),
      label: dStart.toLocaleDateString("en-IN", { weekday: "short" }),
      minutes,
      tasksAssigned: dayTasks.length,
      tasksCompleted: dayTasks.filter((t) => t.status === "completed").length,
    });
  }

  // ---- Streak: consecutive past days (including today) with >=1 completed task ----
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const dStart = startOfDay(day);
    const dEnd = endOfDay(day);
    const count = await Task.countDocuments({
      date: { $gte: dStart, $lte: dEnd },
      status: "completed",
    });
    if (count > 0) streak++;
    else if (i === 0) continue; // today might just not be done yet, don't break streak on day 0
    else break;
  }

  // ---- Subject-wise progress (all-time minutes studied + topics mastered) ----
  const subjects = await Subject.find();
  const subjectStats = [];
  for (const subj of subjects) {
    const tasks = await Task.find({ subject: subj._id, status: "completed" });
    const minutes = tasks.reduce((s, t) => s + (t.actualDurationMinutes || 0), 0);
    const topicsTotal = await Topic.countDocuments({ subject: subj._id });
    const topicsMastered = await Topic.countDocuments({ subject: subj._id, mastered: true });
    subjectStats.push({
      subjectId: subj._id,
      name: subj.name,
      color: subj.color,
      minutesStudied: minutes,
      topicsTotal,
      topicsMastered,
    });
  }

  // ---- Pending revisions (due today or overdue) ----
  const pendingRevisions = await Task.find({
    type: "revision",
    status: { $in: ["pending", "in-progress"] },
    date: { $lte: todayEnd },
  })
    .populate("subject")
    .populate("topic")
    .sort({ date: 1 });

  // ---- Missed tasks in the last 7 days ----
  const missedRecently = await Task.find({
    status: "missed",
    date: { $gte: weekStart, $lte: todayEnd },
  })
    .populate("subject")
    .sort({ date: -1 });

  res.json({
    today: {
      date: todayStart.toISOString().slice(0, 10),
      tasksAssigned: todayTasks.length,
      tasksCompleted: todayCompleted,
      completionPct: todayCompletionPct,
      tasks: todayTasks,
    },
    weeklyMinutes,
    dailyBreakdown,
    streak,
    subjectStats,
    pendingRevisions,
    missedRecently,
  });
});

module.exports = router;
