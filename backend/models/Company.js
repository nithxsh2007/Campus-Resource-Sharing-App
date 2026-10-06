const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
    name: String,
    location: String,
    jobRole: String,
    salary: Number,
    eligibility: String
}, { timestamps: true });

const Company = mongoose.model("Company", companySchema);

module.exports = Company;