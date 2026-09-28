const express = require("express");
const router = express.Router();
const Task = require("../models/Task");
const Topic = require("../models/Topic");
const StudyLog = require("../models/StudyLog");
const { requireAuth, requireManager } = require("../middleware/auth");

router.use(requireAuth);

// Spaced-repetition gaps (in days) used to auto-schedule revision tasks
const REVISION_GAPS = [3, 7, 15];

// GET tasks with optional filters: ?date=YYYY-MM-DD&status=&subject=&from=&to=
router.get("/", async (req, res) => {
  const { date, status, subject, from, to } = req.query;
  const filter = {};

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.date = { $gte: start, $lte: end };
  } else if (from && to) {
    filter.date = { $gte: new Date(from), $lte: new Date(to) };
  }

  if (status) filter.status = status;
  if (subject) filter.subject = subject;

  const tasks = await Task.find(filter)
    .populate("subject")
    .populate("topic")
    .sort({ date: 1, timeSlot: 1 });

  res.json(tasks);
});

// POST create a task / assign study work (manager only)
router.post("/", requireManager, async (req, res) => {
  const { title, subject, topic, type, date, timeSlot, targetDurationMinutes, notes } = req.body;

  if (!title || !subject || !date) {
    return res.status(400).json({ message: "Title, subject and date are required" });
  }

  const task = await Task.create({
    title,
    subject,
    topic: topic || null,
    type: type || "study",
    date,
    timeSlot: timeSlot || "",
    targetDurationMinutes: targetDurationMinutes || 60,
    notes: notes || "",
  });

  const populated = await task.populate(["subject", "topic"]);
  res.status(201).json(populated);
});

// PATCH edit a task's own fields (manager only) - title, date, timeSlot, target, notes
router.patch("/:id", requireManager, async (req, res) => {
  const allowed = ["title", "date", "timeSlot", "targetDurationMinutes", "notes", "type"];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true })
    .populate("subject")
    .populate("topic");
  res.json(task);
});

// DELETE a task (manager only)
router.delete("/:id", requireManager, async (req, res) => {
  await StudyLog.deleteMany({ task: req.params.id });
  await Task.findByIdAndDelete(req.params.id);
  res.json({ message: "Task deleted" });
});

// POST /api/tasks/:id/start - student starts the timer
router.post("/:id/start", async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });

  task.timerStartedAt = new Date();
  task.status = "in-progress";
  await task.save();

  res.json(task);
});

// POST /api/tasks/:id/stop - student stops the timer, logs the duration
router.post("/:id/stop", async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ message: "Task not found" });
  if (!task.timerStartedAt) {
    return res.status(400).json({ message: "Timer was not running for this task" });
  }

  const start = task.timerStartedAt;
  const end = new Date();
  const minutes = Math.max(1, Math.round((end - start) / 60000));

  await StudyLog.create({ task: task._id, startTime: start, endTime: end, durationMinutes: minutes });

  task.actualDurationMinutes += minutes;
  task.timerStartedAt = null;
  task.status = "in-progress";
  await task.save();

  res.json(task);
});

// POST /api/tasks/:id/complete - marks done, triggers auto revision scheduling
router.post("/:id/complete", async (req, res) => {
  const task = await Task.findById(req.params.id).populate("topic");
  if (!task) return res.status(404).json({ message: "Task not found" });

  task.status = "completed";
  task.completedAt = new Date();
  if (task.timerStartedAt) {
    // stop any running timer first
    const minutes = Math.max(1, Math.round((new Date() - task.timerStartedAt) / 60000));
    await StudyLog.create({
      task: task._id,
      startTime: task.timerStartedAt,
      endTime: new Date(),
      durationMinutes: minutes,
    });
    task.actualDurationMinutes += minutes;
    task.timerStartedAt = null;
  }
  await task.save();

  // Auto-schedule the next revision if this was a study or revision task on a topic
  if (task.topic && (task.type === "study" || task.type === "revision")) {
    const topic = await Topic.findById(task.topic._id);
    const stage = topic.revisionStage || 0;

    if (stage < REVISION_GAPS.length) {
      const gapDays = REVISION_GAPS[stage];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + gapDays);

      await Task.create({
        title: `Revise: ${topic.name}`,
        subject: task.subject,
        topic: topic._id,
        type: "revision",
        date: nextDate,
        targetDurationMinutes: 30,
        autoGenerated: true,
      });

      topic.revisionStage = stage + 1;
      topic.lastStudiedAt = new Date();
      await topic.save();
    } else {
      topic.mastered = true;
      topic.lastStudiedAt = new Date();
      await topic.save();
    }
  }

  const populated = await task.populate(["subject", "topic"]);
  res.json(populated);
});

// POST /api/tasks/:id/miss - manager or system marks a task missed
router.post("/:id/miss", requireManager, async (req, res) => {
  const task = await Task.findByIdAndUpdate(
    req.params.id,
    { status: "missed" },
    { new: true }
  );
  res.json(task);
});

module.exports = router;
