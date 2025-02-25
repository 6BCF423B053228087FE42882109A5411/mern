const mongoose = require("mongoose");
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.json());
app.use(cors());

console.log("🔄 Starting Backend...");

// Ensure the MongoDB URI is set
if (!process.env.MONGO_URI) {
  console.error("🚨 ERROR: MONGO_URI is missing in .env file.");
  process.exit(1);
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// Define Student Schema
const StudentSchema = new mongoose.Schema({
  regNumber: String,
  name: String,
  parentNumber: String
});
const Student = mongoose.model("Student", StudentSchema);

// Define Scan Schema
const ScanSchema = new mongoose.Schema({
  regNumber: String,
  name: String,
  parentNumber: String,
  scanTime: { type: Date, default: Date.now }
});
const Scan = mongoose.model("Scan", ScanSchema);

// Twilio Setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.get("/", (req, res) => {
  res.send("✅ Backend is running.");
});

// 📌 Handle Barcode Scan API
app.post("/scan", async (req, res) => {
  try {
    console.log("📥 Received request:", req.body);

    if (!req.body || !req.body.regNumber) {
      console.error("⚠️ Error: regNumber missing in request");
      return res.status(400).json({ error: "Missing regNumber" });
    }

    const regNumber = req.body.regNumber;
    console.log("🔍 Searching for student with regNumber:", regNumber);

    const student = await Student.findOne({ regNumber });
    if (!student) {
      console.error("❌ Error: Student not found for regNumber:", regNumber);
      return res.status(404).json({ error: "Student not found" });
    }

    console.log("✅ Student found:", student);

    // Store scan record
    const scanRecord = new Scan({
      regNumber,
      name: student.name,
      parentNumber: student.parentNumber
    });
    await scanRecord.save();
    console.log("📌 Scan record saved successfully");

    // Get formatted date and time
    const scanTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    // Send SMS to Parent using Twilio
    try {
      const message = await client.messages.create({
        body: `Security Alert: ${student.name} scanned ID at ${scanTime}. Sent from College.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: student.parentNumber
      });

      console.log("📤 SMS sent:", message.sid);
      res.json({ success: true, message: `SMS sent to ${student.parentNumber}` });

    } catch (twilioError) {
      console.error("🚨 Twilio Error:", twilioError);
      return res.status(500).json({ error: "Failed to send SMS", details: twilioError.message });
    }

  } catch (error) {
    console.error("🚨 Internal Server Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// 📌 API to Fetch Scan History
app.get("/scan-history", async (req, res) => {
  try {
    console.log("📡 Fetching scan history...");
    const records = await Scan.find().sort({ scanTime: -1 });
    res.json(records);
  } catch (error) {
    console.error("🚨 Error fetching history:", error);
    res.status(500).json({ error: "Failed to retrieve records" });
  }
});

// Start Server
const PORT = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
