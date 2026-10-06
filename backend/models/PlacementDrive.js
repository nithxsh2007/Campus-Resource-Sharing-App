const mongoose = require("mongoose");

const placementDriveSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    },
    driveDate: {
        type: Date,
        required: true
    },
    jobRole: {
        type: String,
        required: true
    },
    eligibility: {
        type: String,
        required: true
    },
    status: {
        type: String,
        default: "Scheduled"
    }
}, { timestamps: true });

module.exports = mongoose.model("PlacementDrive", placementDriveSchema);