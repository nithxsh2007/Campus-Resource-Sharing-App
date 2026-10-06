const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const User = require("./models/User");
const Student = require("./models/Student");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/placement_management_system");

console.log("MongoDB connected");

app.get("/", (req, res) => {
    res.send("College Placement Backend");
});

// Register
app.post("/register", async (req, res) => {

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    const user = new User({
        name: name,
        email: email,
        password: password
    });

    await user.save();

    res.send("Registration successful");
});

// Login
app.post("/login", async (req, res) => {

    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({
        email: email,
        password: password
    });

    if (user) {
        res.send("Login successful");
    } else {
        res.send("Invalid email or password");
    }
});

// Add Student
app.post("/students", async (req, res) => {

    const name = req.body.name;
    const email = req.body.email;
    const department = req.body.department;
    const cgpa = req.body.cgpa;
    const skills = req.body.skills;

    const student = new Student({
        name: name,
        email: email,
        department: department,
        cgpa: cgpa,
        skills: skills
    });

    await student.save();

    res.send("Student added successfully");
});

// Start server
app.listen(8000, () => {
    console.log("College Placement Student Backend is running on port 8000");
});

