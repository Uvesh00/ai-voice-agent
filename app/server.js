const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const { twiml: { VoiceResponse } } = require("twilio");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// ===== ENV VALUES =====
const MONGO_URI = process.env.MONGO_URI;
const ACCOUNT_SID = process.env.TWILIO_SID;
const AUTH_TOKEN = process.env.TWILIO_TOKEN;
const TWILIO_NUMBER = process.env.TWILIO_NUMBER;
const YOUR_NUMBER = process.env.YOUR_NUMBER;

const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

// ===== DB CONNECT =====
mongoose.connect(MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log(err));

// ===== SCHEMA =====
const Appointment = mongoose.model("Appointment", {
  name: String,
  phone: String,
  time: String,
});

// TEMP STORAGE
let userData = {};

// ===== START CALL =====
app.post("/voice", (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say("Welcome. Please tell your name.");

  twiml.gather({
    input: "speech",
    action: "/name",
    method: "POST",
    speechTimeout: "auto",
    language: "en-IN"
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// ===== NAME =====
app.post("/name", (req, res) => {
  userData.name = req.body.SpeechResult;

  const twiml = new VoiceResponse();
  twiml.say("Tell your phone number.");

  twiml.gather({
    input: "speech",
    action: "/phone",
    method: "POST",
    speechTimeout: "auto"
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// ===== PHONE =====
app.post("/phone", (req, res) => {
  userData.phone = req.body.SpeechResult;

  const twiml = new VoiceResponse();
  twiml.say("Tell your meeting time.");

  twiml.gather({
    input: "speech",
    action: "/time",
    method: "POST",
    speechTimeout: "auto"
  });

  res.type("text/xml");
  res.send(twiml.toString());
});

// ===== FINAL =====
app.post("/time", async (req, res) => {
  userData.time = req.body.SpeechResult;

  const twiml = new VoiceResponse();

  try {
    // SAVE TO DB
    const appointment = new Appointment(userData);
    await appointment.save();

    // SMS TO USER
    await client.messages.create({
      body: `Your meeting is scheduled at ${userData.time}`,
      from: TWILIO_NUMBER,
      to: userData.phone
    });

    // SMS TO YOU
    await client.messages.create({
      body: `New meeting with ${userData.name} at ${userData.time}`,
      from: TWILIO_NUMBER,
      to: YOUR_NUMBER
    });

    twiml.say("Your appointment is booked. You will receive a confirmation message.");

  } catch (err) {
    console.log(err);
    twiml.say("Something went wrong.");
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

app.listen(3000, () => console.log("🚀 Server running"));
