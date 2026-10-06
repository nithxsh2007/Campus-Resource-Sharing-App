const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const { promisify } = require("util");
const User = require("./models/User");
const Student = require("./models/Student");
const Company = require("./models/Company");
const PlacementDrive = require("./models/PlacementDrive");
const PlacementApplication = require("./models/PlacementApplication");

const app = express();
const scrypt = promisify(crypto.scrypt);
const activeSessions = new Map();
const sessionDurationSeconds = 8 * 60 * 60;

app.use(cors());
app.use(express.json());

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password, storedPassword) {
    if (!storedPassword?.startsWith("scrypt$")) return password === storedPassword;
    const [, salt, storedHash] = storedPassword.split("$");
    const hash = await scrypt(password, salt, 64);
    const expected = Buffer.from(storedHash, "hex");
    return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

function getSessionId(req) {
    const cookie = req.headers.cookie?.split(";").map((part) => part.trim())
        .find((part) => part.startsWith("cpmsAuth="));
    return cookie ? decodeURIComponent(cookie.slice("cpmsAuth=".length)) : null;
}

function requireAuth(req, res, next) {
    const sessionId = getSessionId(req);
    const session = sessionId ? activeSessions.get(sessionId) : null;
    if (!session || session.expiresAt <= Date.now()) {
        if (sessionId) activeSessions.delete(sessionId);
        return res.status(401).json({ message: "Sign in to continue" });
    }
    req.auth = session;
    next();
}

function requireAdmin(req, res, next) {
    if (req.auth?.role !== "admin") return res.status(403).json({ message: "Administrator access required" });
    next();
}

function sessionCookie(value, maxAge = sessionDurationSeconds) {
    return `cpmsAuth=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

const seedSampleData = async () => {
    const studentCount = await Student.countDocuments();
    if (studentCount === 0) {
        const sampleStudents = [
            { name: "Aarav Sharma", email: "aarav.sharma@college.edu", department: "Computer Science", cgpa: 8.9, skills: "JavaScript, React, Problem Solving" },
            { name: "Meera Iyer", email: "meera.iyer@college.edu", department: "Information Technology", cgpa: 9.2, skills: "Python, SQL, Data Analysis" },
            { name: "Karan Singh", email: "karan.singh@college.edu", department: "Mechanical Engineering", cgpa: 7.8, skills: "CAD, AutoCAD, Manufacturing" },
            { name: "Nisha Patel", email: "nisha.patel@college.edu", department: "Electronics", cgpa: 8.4, skills: "Embedded C, IoT, Circuit Design" },
            { name: "Rohit Verma", email: "rohit.verma@college.edu", department: "Computer Science", cgpa: 8.1, skills: "Node.js, MongoDB, REST APIs" },
            { name: "Sneha Reddy", email: "sneha.reddy@college.edu", department: "Civil Engineering", cgpa: 7.6, skills: "Project Planning, AutoCAD, Team Leadership" },
            { name: "Vikram Nair", email: "vikram.nair@college.edu", department: "Electrical Engineering", cgpa: 8.7, skills: "Power Systems, MATLAB, Simulation" }
        ];
        await Student.insertMany(sampleStudents);
    }

    let companies = await Company.find().lean();
    if (!companies.length) {
        const sampleCompanies = [
            { name: "Google", location: "Bengaluru", jobRole: "Software Engineer", salary: 2400000, eligibility: "CGPA 7.5+, CS/IT" },
            { name: "Microsoft", location: "Hyderabad", jobRole: "Frontend Developer", salary: 2200000, eligibility: "CGPA 7.0+, CS/IT" },
            { name: "Infosys", location: "Pune", jobRole: "System Engineer", salary: 1200000, eligibility: "CGPA 6.5+, Any stream" },
            { name: "TCS", location: "Chennai", jobRole: "Full Stack Developer", salary: 1300000, eligibility: "CGPA 7.0+, CS/IT/ECE" },
            { name: "Accenture", location: "Mumbai", jobRole: "Data Analyst", salary: 1400000, eligibility: "CGPA 6.8+, Any STEM" },
            { name: "Wipro", location: "Bengaluru", jobRole: "Network Engineer", salary: 980000, eligibility: "CGPA 6.5+, ECE/EEE" }
        ];
        companies = await Company.insertMany(sampleCompanies);
    }

    const driveCount = await PlacementDrive.countDocuments();
    const companyDocs = Array.isArray(companies) && companies.length ? companies : await Company.find().lean();
    if (driveCount === 0 && companyDocs.length >= 4) {
        const sampleDrives = [
            { company: companyDocs[0]._id, driveDate: new Date(Date.now() + 7 * 86400000), jobRole: "Software Engineer", eligibility: "CGPA 7.5+, CS/IT", status: "Scheduled" },
            { company: companyDocs[1]._id, driveDate: new Date(Date.now() + 12 * 86400000), jobRole: "Frontend Developer", eligibility: "CGPA 7.0+, CS/IT", status: "Scheduled" },
            { company: companyDocs[2]._id, driveDate: new Date(Date.now() + 18 * 86400000), jobRole: "System Engineer", eligibility: "CGPA 6.5+, Any stream", status: "Scheduled" },
            { company: companyDocs[3]._id, driveDate: new Date(Date.now() + 25 * 86400000), jobRole: "Full Stack Developer", eligibility: "CGPA 7.0+, CS/IT/ECE", status: "Scheduled" }
        ];
        await PlacementDrive.insertMany(sampleDrives);
    }

    const applicationCount = await PlacementApplication.countDocuments();
    if (applicationCount === 0) {
        const [students, drives] = await Promise.all([
            Student.find().limit(4).lean(),
            PlacementDrive.find().limit(3).lean()
        ]);

        if (students.length >= 4 && drives.length >= 3) {
            const sampleApplications = [
                { student: students[0]._id, drive: drives[0]._id, status: "Selected" },
                { student: students[1]._id, drive: drives[0]._id, status: "Shortlisted" },
                { student: students[2]._id, drive: drives[1]._id, status: "Applied" },
                { student: students[3]._id, drive: drives[2]._id, status: "Placed" }
            ];
            await PlacementApplication.insertMany(sampleApplications);
        }
    }
};

mongoose.connect("mongodb://127.0.0.1:27017/placement_management_system")
    .then(async () => {
        console.log("MongoDB connected");
        try {
            await seedSampleData();
        } catch (error) {
            console.error("Seed sample data error:", error);
        }
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
    });

app.post("/register", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2 || !email || password.length < 6) {
        return res.status(400).send("Enter a name, email, and password with at least 6 characters.");
    }
    if (await User.exists({ email })) return res.status(409).send("An account with this email already exists.");

    const isFirstAccount = (await User.countDocuments()) === 0;
    const user = await User.create({
        name,
        email,
        password: await hashPassword(password),
        role: isFirstAccount ? "admin" : "officer"
    });
    res.status(201).json({ message: "Registration successful", role: user.role });
});

app.post("/login", async (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await User.findOne({ email });
    if (!user || !(await verifyPassword(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!await User.exists({ role: "admin" })) user.role = "admin";
    if (!user.password.startsWith("scrypt$")) user.password = await hashPassword(password);
    await user.save();

    const sessionId = crypto.randomBytes(32).toString("hex");
    activeSessions.set(sessionId, {
        userId: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        expiresAt: Date.now() + sessionDurationSeconds * 1000
    });
    res.setHeader("Set-Cookie", sessionCookie(sessionId));
    res.json({ userId: String(user._id), email: user.email, name: user.name, role: user.role });
});

app.post("/logout", requireAuth, (req, res) => {
    const sessionId = getSessionId(req);
    activeSessions.delete(sessionId);
    res.setHeader("Set-Cookie", sessionCookie("", 0));
    res.sendStatus(204);
});

app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ userId: req.auth.userId, email: req.auth.email, name: req.auth.name, role: req.auth.role });
});

app.use((req, res, next) => {
    if (["/dashboard.html", "/student-profile.html"].includes(req.path)) {
        const sessionId = getSessionId(req);
        const session = sessionId ? activeSessions.get(sessionId) : null;
        if (!session || session.expiresAt <= Date.now()) return res.redirect("/");
        req.auth = session;
    }
    return next();
});
app.use(express.static(path.join(__dirname, "../frontend")));

app.use((req, res, next) => {
    const isDataRoute = req.path.startsWith("/api/") || /^\/(students|companies|drives|applications)(\/|$)/.test(req.path);
    if (isDataRoute && req.path !== "/api/auth/me") return requireAuth(req, res, next);
    next();
});

const getRecordDate = (record) => record.createdAt || record._id.getTimestamp();

function checkEligibility(student, drive) {
    const text = drive.eligibility || "";
    const minimumMatch = text.match(/\b(?:cgpa|gpa)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
    const departmentRequirement = text.includes(",") ? text.slice(text.indexOf(",") + 1).trim() : "";
    const checks = [];

    if (minimumMatch) {
        const minimum = Number(minimumMatch[1]);
        checks.push({
            label: `CGPA ${minimum.toFixed(1)} minimum`,
            passed: Number(student.cgpa) >= minimum,
            actual: Number(student.cgpa) || 0
        });
    }

    if (departmentRequirement && !/any\s+(stream|discipline)/i.test(departmentRequirement)) {
        const department = String(student.department || "").toLowerCase();
        let departmentMatches;
        if (/any\s+stem/i.test(departmentRequirement)) {
            departmentMatches = /science|technology|engineer|math|computer|information|electronics|electrical|civil|mechanical/i.test(department);
        } else {
            const aliases = {
                cs: /computer science|computer engineering/i,
                cse: /computer science|computer engineering/i,
                it: /information technology|information systems/i,
                ece: /electronics|communication/i,
                eee: /electrical|electronics/i
            };
            const acceptedDepartments = departmentRequirement.split(/\/|\bor\b|\|/i).map((value) => value.trim()).filter(Boolean);
            departmentMatches = acceptedDepartments.some((accepted) => {
                const pattern = aliases[accepted.toLowerCase()];
                return pattern ? pattern.test(department) : department.includes(accepted.toLowerCase());
            });
        }
        checks.push({ label: `Department: ${departmentRequirement}`, passed: departmentMatches });
    }

    return { eligible: checks.every((check) => check.passed), checks };
}

app.get("/api/eligibility/:driveId", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.driveId)) return res.status(400).json({ message: "Invalid placement drive ID" });
    const drive = await PlacementDrive.findById(req.params.driveId).populate("company", "name").lean();
    if (!drive) return res.status(404).json({ message: "Placement drive not found" });

    const [students, applications] = await Promise.all([
        Student.find().sort({ name: 1 }).lean(),
        PlacementApplication.find({ drive: req.params.driveId }).select("student").lean()
    ]);
    const appliedIds = new Set(applications.map((application) => String(application.student)));
    const eligibleStudents = students.map((student) => ({
        _id: student._id,
        name: student.name,
        email: student.email,
        department: student.department,
        cgpa: student.cgpa,
        alreadyApplied: appliedIds.has(String(student._id)),
        ...checkEligibility(student, drive)
    }));

    res.json({
        drive: { ...drive, companyName: drive.company?.name || "Company" },
        eligibleCount: eligibleStudents.filter((student) => student.eligible).length,
        students: eligibleStudents
    });
});

app.get("/api/reports/placements", async (req, res) => {
    const [students, applications, totalCompanies, totalDrives] = await Promise.all([
        Student.find().select("name email department").lean(),
        PlacementApplication.find()
            .populate("student", "name email department")
            .populate({ path: "drive", populate: { path: "company", select: "name" } })
            .sort({ updatedAt: -1 })
            .lean(),
        Company.countDocuments(),
        PlacementDrive.countDocuments()
    ]);

    const statusCounts = { Applied: 0, Shortlisted: 0, Interview: 0, Selected: 0, Rejected: 0, Placed: 0 };
    const placedStudentIds = new Set();
    const departmentTotals = new Map();
    students.forEach((student) => {
        const key = student.department || "Unspecified";
        if (!departmentTotals.has(key)) departmentTotals.set(key, { department: key, students: 0, placed: 0 });
        departmentTotals.get(key).students += 1;
    });
    applications.forEach((application) => {
        if (Object.hasOwn(statusCounts, application.status)) statusCounts[application.status] += 1;
        if (application.status === "Placed" && application.student?._id) {
            const studentId = String(application.student._id);
            if (!placedStudentIds.has(studentId)) {
                placedStudentIds.add(studentId);
                const department = application.student.department || "Unspecified";
                if (!departmentTotals.has(department)) departmentTotals.set(department, { department, students: 0, placed: 0 });
                departmentTotals.get(department).placed += 1;
            }
        }
    });

    res.json({
        generatedAt: new Date(),
        summary: {
            totalStudents: students.length,
            totalCompanies,
            totalDrives,
            totalApplications: applications.length,
            studentsPlaced: placedStudentIds.size,
            placementRate: students.length ? Math.round((placedStudentIds.size / students.length) * 100) : 0
        },
        statusCounts,
        departmentBreakdown: [...departmentTotals.values()].sort((a, b) => a.department.localeCompare(b.department)),
        applications: applications.map((application) => ({
            studentName: application.student?.name || "Student unavailable",
            email: application.student?.email || "",
            department: application.student?.department || "Unspecified",
            company: application.drive?.company?.name || "Company unavailable",
            jobRole: application.drive?.jobRole || "Role unavailable",
            status: application.status,
            updatedAt: application.updatedAt || application.createdAt
        }))
    });
});

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
    const [users, students, companies, drives, applications] = await Promise.all([
        User.countDocuments(), Student.countDocuments(), Company.countDocuments(),
        PlacementDrive.countDocuments(), PlacementApplication.countDocuments()
    ]);
    res.json({
        database: mongoose.connection.name,
        connection: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
        counts: { users, students, companies, drives, applications }
    });
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const users = await User.find().select("name email role createdAt").sort({ createdAt: 1 }).lean();
    res.json(users);
});

app.patch("/api/admin/users/:id/role", requireAdmin, async (req, res) => {
    const role = req.body.role;
    if (!["admin", "officer"].includes(role)) return res.status(400).json({ message: "Role must be admin or officer" });
    if (String(req.auth.userId) === req.params.id && role !== "admin") {
        return res.status(400).json({ message: "You cannot remove your own administrator access" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Account not found" });
    if (user.role === "admin" && role !== "admin" && await User.countDocuments({ role: "admin" }) <= 1) {
        return res.status(400).json({ message: "At least one administrator account must remain" });
    }
    user.role = role;
    await user.save();
    for (const [sessionId, session] of activeSessions) {
        if (session.userId === String(user._id)) activeSessions.delete(sessionId);
    }
    res.json({ message: "Account role updated. The account must sign in again.", user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
});

app.get("/api/admin/backup", requireAdmin, async (req, res) => {
    const [students, companies, drives, applications] = await Promise.all([
        Student.find().lean(), Company.find().lean(), PlacementDrive.find().lean(), PlacementApplication.find().lean()
    ]);
    res.setHeader("Content-Disposition", `attachment; filename=cpms-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json({
        exportedAt: new Date().toISOString(),
        database: mongoose.connection.name,
        collections: { students, companies, drives, applications }
    });
});

app.get("/api/dashboard", async (req, res) => {
    const [
        totalStudents,
        totalCompanies,
        totalDrives,
        placedStudentIds,
        statusTotals,
        students,
        companies,
        companyOptions,
        upcomingDrives,
        recentDrives,
        recentApplications
    ] = await Promise.all([
        Student.countDocuments(),
        Company.countDocuments(),
        PlacementDrive.countDocuments(),
        PlacementApplication.distinct("student", { status: "Placed" }),
        PlacementApplication.aggregate([
            { $group: { _id: "$status", total: { $sum: 1 } } }
        ]),
        Student.find().sort({ createdAt: -1, _id: -1 }).limit(8).lean(),
        Company.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
        Company.find().select("name").sort({ name: 1 }).limit(200).lean(),
        PlacementDrive.find({ driveDate: { $gte: new Date() } })
            .populate("company", "name")
            .sort({ driveDate: 1 })
            .limit(8)
            .lean(),
        PlacementDrive.find()
            .populate("company", "name")
            .sort({ createdAt: -1, _id: -1 })
            .limit(8)
            .lean(),
        PlacementApplication.find()
            .populate("student", "name email")
            .populate({ path: "drive", populate: { path: "company", select: "name" } })
            .sort({ updatedAt: -1, _id: -1 })
            .limit(8)
            .lean()
    ]);

    const placementStatus = {
        Applied: 0,
        Shortlisted: 0,
        Interview: 0,
        Selected: 0,
        Rejected: 0,
        Placed: 0
    };
    statusTotals.forEach(({ _id, total }) => {
        if (Object.hasOwn(placementStatus, _id)) placementStatus[_id] = total;
    });

    const recentStudents = students.map((student) => ({
        ...student,
        registrationDate: getRecordDate(student)
    }));
    const recentCompanies = companies.map((company) => ({
        ...company,
        registrationDate: getRecordDate(company)
    }));

    const activity = [
        ...recentStudents.map((student) => ({
            type: "student",
            message: `New student registered: ${student.name || student.email}`,
            date: student.registrationDate
        })),
        ...recentCompanies.map((company) => ({
            type: "company",
            message: `New company added: ${company.name}`,
            date: company.registrationDate
        })),
        ...recentDrives.map((drive) => ({
            type: "drive",
            message: `Placement drive added: ${drive.company?.name || "Company"} - ${drive.jobRole}`,
            date: getRecordDate(drive)
        })),
        ...recentApplications.map((application) => ({
            type: "placement",
            message: application.status === "Selected"
                ? `Student selected: ${application.student?.name || "Student"}`
                : `Placement update: ${application.student?.name || "Student"} - ${application.status}`,
            date: application.updatedAt || getRecordDate(application)
        }))
    ].sort((first, second) => new Date(second.date) - new Date(first.date)).slice(0, 10);

    const upcoming = upcomingDrives.map((drive) => ({
        ...drive,
        companyName: drive.company?.name || "Company"
    }));
    const notifications = [
        ...upcoming.slice(0, 3).map((drive) => ({
            type: "drive",
            message: `Upcoming drive: ${drive.companyName} - ${drive.jobRole}`,
            date: drive.driveDate
        })),
        ...recentCompanies.slice(0, 3).map((company) => ({
            type: "company",
            message: `Recently added company: ${company.name}`,
            date: company.registrationDate
        })),
        ...recentApplications.slice(0, 3).map((application) => ({
            type: "placement",
            message: `${application.student?.name || "Student"}: ${application.status}`,
            date: application.updatedAt || getRecordDate(application)
        }))
    ].sort((first, second) => new Date(second.date) - new Date(first.date)).slice(0, 8);

    res.json({
        stats: {
            totalStudents,
            totalCompanies,
            totalDrives,
            studentsPlaced: placedStudentIds.length
        },
        placementStatus,
        recentStudents,
        recentCompanies,
        upcomingDrives: upcoming,
        driveOptions: recentDrives.map((drive) => ({
            ...drive,
            companyName: drive.company?.name || "Company"
        })),
        notifications,
        activity,
        companyOptions
    });
});

app.get("/api/search", async (req, res) => {
    const query = String(req.query.q || "").trim();
    if (!query) return res.json({ students: [], companies: [] });

    const regexCharacters = ".^$*+?()[]{}|\\";
    const escapedQuery = Array.from(query, (character) =>
        regexCharacters.includes(character) ? `\\${character}` : character
    ).join("");
    const search = new RegExp(escapedQuery, "i");
    const [students, companies] = await Promise.all([
        Student.find({ $or: [{ name: search }, { email: search }, { department: search }] })
            .sort({ createdAt: -1, _id: -1 })
            .limit(8)
            .lean(),
        Company.find({ $or: [{ name: search }, { location: search }, { jobRole: search }] })
            .sort({ createdAt: -1, _id: -1 })
            .limit(8)
            .lean()
    ]);

    res.json({ students, companies });
});

app.post("/companies", async (req, res) => {
    const company = new Company(req.body);
    await company.save();
    res.status(201).send("Company added successfully");
});

app.post("/drives", async (req, res) => {
    const drive = new PlacementDrive(req.body);
    await drive.save();
    res.status(201).send("Placement drive added successfully");
});

app.post("/applications", async (req, res) => {
    const { student, drive, status = "Applied" } = req.body;
    if (!student || !drive) {
        return res.status(400).send("Student and placement drive are required");
    }

    await PlacementApplication.findOneAndUpdate(
        { student, drive },
        { $set: { status } },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).send("Placement status saved successfully");
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

app.get("/students", async (req, res) => {
    const students = await Student.find().sort({ createdAt: -1, _id: -1 }).lean();
    res.json(students.map((student) => ({
        ...student,
        registrationDate: getRecordDate(student)
    })));
});

app.get("/students/:id", async (req, res) => {
    const student = await Student.findById(req.params.id).lean();
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ ...student, registrationDate: getRecordDate(student) });
});

app.get("/api/students/:id/profile", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid student ID" });
    }

    const [student, applications, drives] = await Promise.all([
        Student.findById(req.params.id).lean(),
        PlacementApplication.find({ student: req.params.id })
            .populate({
                path: "drive",
                populate: { path: "company", select: "name location" }
            })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean(),
        PlacementDrive.find()
            .populate("company", "name location")
            .sort({ driveDate: 1 })
            .lean()
    ]);

    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({
        student: { ...student, registrationDate: getRecordDate(student) },
        applications: applications.map((application) => ({
            ...application,
            drive: application.drive ? {
                ...application.drive,
                companyName: application.drive.company?.name || "Company"
            } : null
        })),
        availableDrives: drives.map((drive) => ({
            ...drive,
            companyName: drive.company?.name || "Company"
        }))
    });
});

app.put("/students/:id", async (req, res) => {
    const { name, email, department, cgpa, skills } = req.body;
    const student = await Student.findByIdAndUpdate(
        req.params.id,
        { name, email, department, cgpa: Number(cgpa), skills },
        { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json({ message: "Student updated successfully", student });
});

app.delete("/students/:id", async (req, res) => {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    await PlacementApplication.deleteMany({ student: req.params.id });
    res.json({ message: "Student deleted successfully" });
});

app.get("/companies", async (req, res) => {
    const companies = await Company.find().sort({ createdAt: -1, _id: -1 }).lean();
    res.json(companies.map((company) => ({
        ...company,
        registrationDate: getRecordDate(company)
    })));
});

app.get("/companies/:id", async (req, res) => {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ ...company, registrationDate: getRecordDate(company) });
});

app.put("/companies/:id", async (req, res) => {
    const { name, location, jobRole, salary, eligibility } = req.body;
    const company = await Company.findByIdAndUpdate(
        req.params.id,
        { name, location, jobRole, salary: salary ? Number(salary) : undefined, eligibility },
        { new: true, runValidators: true }
    );
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company updated successfully", company });
});

app.delete("/companies/:id", async (req, res) => {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });
    const drives = await PlacementDrive.find({ company: req.params.id });
    const driveIds = drives.map((drive) => drive._id);
    await PlacementDrive.deleteMany({ company: req.params.id });
    await PlacementApplication.deleteMany({ drive: { $in: driveIds } });
    res.json({ message: "Company deleted successfully" });
});

app.get("/drives", async (req, res) => {
    const drives = await PlacementDrive.find()
        .populate("company", "name")
        .sort({ driveDate: 1, createdAt: -1 })
        .lean();

    res.json(drives.map((drive) => ({
        ...drive,
        companyName: drive.company?.name || "Company",
        registrationDate: getRecordDate(drive)
    })));
});

app.get("/drives/:id", async (req, res) => {
    const drive = await PlacementDrive.findById(req.params.id).populate("company", "name").lean();
    if (!drive) return res.status(404).json({ message: "Placement drive not found" });
    res.json({
        ...drive,
        companyName: drive.company?.name || "Company",
        registrationDate: getRecordDate(drive)
    });
});

app.put("/drives/:id", async (req, res) => {
    const { company, driveDate, jobRole, eligibility, status } = req.body;
    const drive = await PlacementDrive.findByIdAndUpdate(
        req.params.id,
        { company, driveDate, jobRole, eligibility, status },
        { new: true, runValidators: true }
    );
    if (!drive) return res.status(404).json({ message: "Placement drive not found" });
    res.json({ message: "Placement drive updated successfully", drive });
});

app.delete("/drives/:id", async (req, res) => {
    const drive = await PlacementDrive.findByIdAndDelete(req.params.id);
    if (!drive) return res.status(404).json({ message: "Placement drive not found" });
    await PlacementApplication.deleteMany({ drive: req.params.id });
    res.json({ message: "Placement drive deleted successfully" });
});

// Start server
app.listen(8000, () => {
    console.log("College Placement Student Backend is running on port 8000");
});

