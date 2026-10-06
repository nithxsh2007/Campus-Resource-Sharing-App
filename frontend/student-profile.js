const sessionValue = sessionStorage.getItem("cpmsSession");
let session;

try {
    session = sessionValue ? JSON.parse(sessionValue) : null;
} catch {
    session = null;
}

if (!session?.email) {
    window.location.replace("/");
} else {
    const studentId = new URLSearchParams(window.location.search).get("id");
    const statusNames = ["Applied", "Shortlisted", "Interview", "Selected", "Rejected", "Placed"];
    const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
    let profileData;

    document.querySelector("#sidebar-email").textContent = session.email;
    document.querySelector("#account-avatar").textContent = session.email.trim().charAt(0).toUpperCase() || "C";
    document.querySelector("#profile-record-id").textContent = studentId ? ` / ${studentId.slice(-6).toUpperCase()}` : "";
    document.querySelector("#logout-button").addEventListener("click", () => {
        fetch("/logout", { method: "POST" }).finally(() => {
            sessionStorage.removeItem("cpmsSession");
            window.location.assign("/");
        });
    });

    function formatDate(value) {
        if (!value) return "Date unavailable";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
    }

    function addText(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text ?? "";
        parent.append(element);
        return element;
    }

    function showFeedback(selector, message, success = false) {
        const feedback = document.querySelector(selector);
        feedback.textContent = message;
        feedback.classList.toggle("is-success", success);
    }

    function renderApplications() {
        const { applications, availableDrives } = profileData;
        const list = document.querySelector("#application-list");
        const driveSelect = document.querySelector("#application-drive");
        const appliedDriveIds = new Set(applications.map((application) => application.drive?._id).filter(Boolean));
        const available = availableDrives.filter((drive) => !appliedDriveIds.has(drive._id));
        list.replaceChildren();
        driveSelect.replaceChildren(new Option("Choose a drive", ""));
        available.forEach((drive) => {
            driveSelect.add(new Option(`${drive.companyName} · ${drive.jobRole}`, drive._id));
        });
        document.querySelector("#add-application-button").disabled = !available.length;
        document.querySelector("#application-drive").disabled = !available.length;
        if (!available.length) {
            driveSelect.replaceChildren(new Option(applications.length ? "All drives are already listed" : "No placement drives available", ""));
        }

        document.querySelector("#application-count").textContent = `${applications.length} ${applications.length === 1 ? "RECORD" : "RECORDS"}`;
        document.querySelector("#summary-applications").textContent = applications.length;
        document.querySelector("#summary-placed").textContent = applications.filter((application) => application.status === "Placed").length;

        if (!applications.length) {
            addText(list, "p", "empty-state", "No placement activity yet. Add a drive to start tracking this student's journey.");
            return;
        }

        applications.forEach((application) => {
            const drive = application.drive;
            const item = document.createElement("article");
            item.className = "application-item";
            const marker = addText(item, "span", `application-marker status-${String(application.status || "applied").toLowerCase()}`, "");
            marker.setAttribute("aria-hidden", "true");
            const copy = document.createElement("div");
            copy.className = "application-copy";
            addText(copy, "strong", "", drive?.companyName || "Drive unavailable");
            addText(copy, "span", "application-role", drive?.jobRole || "Placement drive");
            addText(copy, "span", "application-date", drive?.driveDate ? `Drive date · ${formatDate(drive.driveDate)}` : `Updated · ${formatDate(application.updatedAt)}`);
            item.append(copy);

            const controls = document.createElement("div");
            controls.className = "application-controls";
            const statusSelect = document.createElement("select");
            statusSelect.setAttribute("aria-label", `Status for ${drive?.companyName || "placement drive"}`);
            statusNames.forEach((status) => statusSelect.add(new Option(status, status)));
            statusSelect.value = application.status || "Applied";
            const updateButton = addText(controls, "button", "profile-inline-button", "Update");
            updateButton.type = "button";
            updateButton.addEventListener("click", async () => {
                updateButton.disabled = true;
                try {
                    const response = await fetch("/applications", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ student: studentId, drive: application.drive?._id, status: statusSelect.value })
                    });
                    const result = (await response.text()).trim();
                    if (!response.ok) throw new Error(result || "Could not update placement status.");
                    await loadProfile();
                } catch (error) {
                    showFeedback("#application-feedback", error.message || "Could not update placement status.");
                } finally {
                    updateButton.disabled = false;
                }
            });
            controls.prepend(statusSelect);
            item.append(controls);
            list.append(item);
        });
    }

    function renderProfile() {
        const student = profileData.student;
        const initials = (student.name || "Student").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
        document.querySelector("#profile-avatar").textContent = initials || "S";
        document.querySelector("#profile-name").textContent = student.name || "Unnamed student";
        const emailLink = document.querySelector("#profile-email-link");
        emailLink.textContent = student.email || "No email address";
        emailLink.href = student.email ? `mailto:${student.email}` : "#";
        document.querySelector("#profile-department").textContent = student.department || "Department not specified";
        document.querySelector("#detail-department").textContent = student.department || "Not specified";
        document.querySelector("#detail-cgpa").textContent = student.cgpa ?? "Not provided";
        document.querySelector("#detail-skills").textContent = student.skills || "No skills listed";
        document.querySelector("#detail-registered").textContent = formatDate(student.registrationDate);
        document.querySelector("#profile-registered").textContent = `ADDED ${formatDate(student.registrationDate).toUpperCase()}`;
        document.querySelector("#summary-cgpa").textContent = student.cgpa ?? "—";

        const completeness = [student.name, student.email, student.department, student.cgpa !== undefined && student.cgpa !== null, student.skills]
            .filter((value) => Boolean(value)).length * 20;
        document.querySelector("#completeness-value").textContent = `${completeness}%`;
        document.querySelector("#completeness-bar").style.width = `${completeness}%`;
        renderApplications();
        document.querySelector("#profile-loading").hidden = true;
        document.querySelector("#profile-page").hidden = false;
    }

    async function loadProfile() {
        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/profile`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Could not load student profile.");
        profileData = result;
        renderProfile();
    }

    document.querySelector("#edit-profile-button").addEventListener("click", () => {
        const form = document.querySelector("#profile-edit-form");
        const student = profileData.student;
        document.querySelector("#edit-name").value = student.name || "";
        document.querySelector("#edit-email").value = student.email || "";
        document.querySelector("#edit-department").value = student.department || "";
        document.querySelector("#edit-cgpa").value = student.cgpa ?? "";
        document.querySelector("#edit-skills").value = student.skills || "";
        form.hidden = false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        document.querySelector("#edit-name").focus();
    });

    document.querySelector("#cancel-profile-edit").addEventListener("click", () => {
        document.querySelector("#profile-edit-form").hidden = true;
        showFeedback("#edit-feedback", "");
    });

    document.querySelector("#profile-edit-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = Object.fromEntries(new FormData(form).entries());
        const button = document.querySelector("#save-profile-button");
        button.disabled = true;
        try {
            const response = await fetch(`/students/${encodeURIComponent(studentId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, cgpa: Number(formData.cgpa) })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Could not save student profile.");
            showFeedback("#edit-feedback", "Profile updated.", true);
            await loadProfile();
            form.hidden = true;
        } catch (error) {
            showFeedback("#edit-feedback", error.message || "Could not save student profile.");
        } finally {
            button.disabled = false;
        }
    });

    document.querySelector("#copy-email-button").addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(profileData.student.email || "");
            showFeedback("#application-feedback", "Email address copied.", true);
        } catch {
            showFeedback("#application-feedback", "Clipboard access is unavailable in this browser.");
        }
    });

    document.querySelector("#print-profile-button").addEventListener("click", () => window.print());
    document.querySelector("#delete-profile-button").addEventListener("click", async () => {
        if (!window.confirm(`Delete ${profileData.student.name || "this student"}? This also removes their placement history.`)) return;
        const response = await fetch(`/students/${encodeURIComponent(studentId)}`, { method: "DELETE" });
        const result = await response.json();
        if (!response.ok) {
            showFeedback("#application-feedback", result.message || "Could not delete student.");
            return;
        }
        window.location.assign("/dashboard.html#student-profiles");
    });

    document.querySelector("#add-application-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        const button = document.querySelector("#add-application-button");
        button.disabled = true;
        try {
            const response = await fetch("/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, student: studentId })
            });
            const result = (await response.text()).trim();
            if (!response.ok) throw new Error(result || "Could not add placement drive.");
            form.reset();
            showFeedback("#application-feedback", "Drive added to placement journey.", true);
            await loadProfile();
        } catch (error) {
            showFeedback("#application-feedback", error.message || "Could not add placement drive.");
        } finally {
            button.disabled = !profileData.availableDrives.some((drive) =>
                !profileData.applications.some((application) => application.drive?._id === drive._id)
            );
        }
    });

    if (!studentId) {
        document.querySelector("#profile-loading").textContent = "Student profile ID is missing. Return to the directory to choose a student.";
    } else {
        loadProfile().catch((error) => {
            document.querySelector("#profile-loading").textContent = error.message || "Could not load student profile.";
        });
    }
}