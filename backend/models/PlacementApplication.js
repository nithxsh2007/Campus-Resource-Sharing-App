const mongoose = require("mongoose");

const placementApplicationSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true
    },
    drive: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PlacementDrive",
        required: true
    },
    status: {
        type: String,
        enum: ["Applied", "Shortlisted", "Interview", "Selected", "Rejected", "Placed"],
        default: "Applied"
    }
}, { timestamps: true });

placementApplicationSchema.index({ student: 1, drive: 1 }, { unique: true });

module.exports = mongoose.model("PlacementApplication", placementApplicationSchema);