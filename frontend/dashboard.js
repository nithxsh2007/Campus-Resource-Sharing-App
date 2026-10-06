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
    const email = session.email;
    const initial = email.trim().charAt(0).toUpperCase() || "C";

    document.querySelector("#sidebar-email").textContent = email;
    document.querySelector("#welcome-email").textContent = email;
    document.querySelector("#account-avatar").textContent = initial;
    document.querySelector("#today-date").textContent = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
    }).format(new Date());

    document.querySelector("#logout-button").addEventListener("click", () => {
        fetch("/logout", { method: "POST" }).finally(() => {
            sessionStorage.removeItem("cpmsSession");
            window.location.assign("/");
        });
    });

    const studentForm = document.querySelector("#student-form");
    const studentIdInput = document.querySelector("#student-id");
    const studentMessage = document.querySelector("#student-message");
    const saveButton = document.querySelector("#save-student-button");
    const cancelStudentEditButton = document.querySelector("#cancel-student-edit");
    const companyForm = document.querySelector("#company-form");
    const companyIdInput = document.querySelector("#company-id");
    const driveForm = document.querySelector("#drive-form");
    const driveIdInput = document.querySelector("#drive-id");
    const recordViewDialog = document.querySelector("#record-view-dialog");
    const recordViewContent = document.querySelector("#record-view-content");

    const statusNames = ["Applied", "Shortlisted", "Interview", "Selected", "Rejected", "Placed"];
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
    let searchTimer;
    let searchRequest = 0;

    function formatDate(value) {
        if (!value) return "Date unavailable";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Date unavailable" : dateFormatter.format(date);
    }

    function renderEligibility(data) {
        const rows = document.querySelector("#eligibility-rows");
        const eligibleOnly = document.querySelector("#eligible-only").checked;
        const students = eligibleOnly ? data.students.filter((student) => student.eligible) : data.students;
        rows.replaceChildren();
        document.querySelector("#eligibility-count").textContent = `${data.eligibleCount} ELIGIBLE / ${data.students.length} STUDENTS`;
        if (!students.length) {
            const row = addText(rows, "tr", "empty-row", "");
            const cell = addText(row, "td", "empty-cell", eligibleOnly ? "No eligible students match this drive." : "No student records available.");
            cell.colSpan = 5;
            return;
        }

        students.forEach((student) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            const link = addText(nameCell, "a", "student-name-link", student.name || "Unnamed student");
            link.href = `/student-profile.html?id=${encodeURIComponent(student._id)}`;
            row.append(nameCell);
            addText(row, "td", "", student.department || "Not specified");
            addText(row, "td", "", student.cgpa ?? "—");
            const result = addText(row, "td", student.eligible ? "eligibility-pass" : "eligibility-fail", student.eligible ? "Eligible" : "Not eligible");
            if (student.alreadyApplied) result.textContent += " · Applied";
            addText(row, "td", "eligibility-checks", student.checks.map((check) => `${check.label}: ${check.passed ? "meets" : "does not meet"}`).join(" · ") || "No restrictions specified");
            rows.append(row);
        });
    }

    async function loadReports() {
        const response = await fetch("/api/reports/placements");
        const report = await response.json();
        if (!response.ok) throw new Error(report.message || "Could not load placement reports.");
        document.querySelector("#report-applications").textContent = report.summary.totalApplications;
        document.querySelector("#report-shortlisted").textContent = report.statusCounts.Shortlisted;
        document.querySelector("#report-interviews").textContent = report.statusCounts.Interview;
        document.querySelector("#report-rate").textContent = `${report.summary.placementRate}%`;
        document.querySelector("#report-generated").textContent = `UPDATED ${formatDate(report.generatedAt).toUpperCase()}`;
        const rows = document.querySelector("#report-department-rows");
        rows.replaceChildren();
        if (!report.departmentBreakdown.length) {
            const row = addText(rows, "tr", "empty-row", "");
            const cell = addText(row, "td", "empty-cell", "No placement outcomes to report yet.");
            cell.colSpan = 4;
        }
        report.departmentBreakdown.forEach((department) => {
            const row = document.createElement("tr");
            addText(row, "td", "student-name-cell", department.department);
            addText(row, "td", "", department.students);
            addText(row, "td", "", department.placed);
            addText(row, "td", "", `${department.students ? Math.round(department.placed / department.students * 100) : 0}%`);
            rows.append(row);
        });
    }

    async function loadAdminTools() {
        const [overviewResponse, usersResponse] = await Promise.all([
            fetch("/api/admin/overview"),
            fetch("/api/admin/users")
        ]);
        const [overview, users] = await Promise.all([overviewResponse.json(), usersResponse.json()]);
        if (!overviewResponse.ok || !usersResponse.ok) throw new Error("Administrator tools could not be loaded.");
        document.querySelector("#database-name").textContent = `Database: ${overview.database}`;
        document.querySelector("#database-state").textContent = `Connection: ${overview.connection}`;
        const counts = document.querySelector("#admin-overview");
        counts.replaceChildren();
        Object.entries(overview.counts).forEach(([label, value]) => {
            const item = document.createElement("div");
            addText(item, "span", "", label);
            addText(item, "strong", "", value);
            counts.append(item);
        });

        const rows = document.querySelector("#admin-user-rows");
        rows.replaceChildren();
        users.forEach((user) => {
            const row = document.createElement("tr");
            addText(row, "td", "student-name-cell", user.name || "Unnamed user");
            addText(row, "td", "", user.email);
            addText(row, "td", "", user.role === "admin" ? "Administrator" : "Placement Officer");
            const actionCell = document.createElement("td");
            if (user._id !== session.userId) {
                const roleSelect = document.createElement("select");
                roleSelect.className = "admin-role-select";
                roleSelect.setAttribute("aria-label", `Role for ${user.email}`);
                roleSelect.add(new Option("Administrator", "admin"));
                roleSelect.add(new Option("Placement Officer", "officer"));
                roleSelect.value = user.role || "officer";
                roleSelect.addEventListener("change", async () => {
                    try {
                        const result = await fetch(`/api/admin/users/${encodeURIComponent(user._id)}/role`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ role: roleSelect.value })
                        });
                        const body = await result.json();
                        if (!result.ok) throw new Error(body.message || "Could not update account role.");
                        document.querySelector("#admin-feedback").textContent = body.message;
                        await loadAdminTools();
                    } catch (error) {
                        document.querySelector("#admin-feedback").textContent = error.message;
                        roleSelect.value = user.role || "officer";
                    }
                });
                actionCell.append(roleSelect);
            } else {
                addText(actionCell, "span", "current-account-label", "Current account");
            }
            row.append(actionCell);
            rows.append(row);
        });
    }

    async function exportReport() {
        const response = await fetch("/api/reports/placements");
        const report = await response.json();
        if (!response.ok) throw new Error(report.message || "Could not export this report.");
        const columns = ["Student", "Email", "Department", "Company", "Job role", "Status", "Updated"];
        const records = report.applications.map((application) => [
            application.studentName, application.email, application.department, application.company,
            application.jobRole, application.status, formatDate(application.updatedAt)
        ]);
        const csv = [columns, ...records].map((record) => record.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `cpms-placement-report-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function addText(parent, tagName, className, text) {
        const element = document.createElement(tagName);
        if (className) element.className = className;
        element.textContent = text ?? "";
        parent.append(element);
        return element;
    }

    function setStudentFormMode(student = null) {
        const editing = Boolean(student && student._id);
        studentIdInput.value = student?._id || "";
        saveButton.textContent = editing ? "Update student profile" : "Save student profile";
        cancelStudentEditButton.hidden = !editing;

        if (editing) {
            document.querySelector("#student-form-title").textContent = "Edit student profile";
            document.querySelector("#student-name").value = student.name || "";
            document.querySelector("#student-email").value = student.email || "";
            document.querySelector("#student-department").value = student.department || "";
            document.querySelector("#student-cgpa").value = student.cgpa ?? "";
            document.querySelector("#student-skills").value = student.skills || "";
        } else {
            document.querySelector("#student-form-title").textContent = "Add student profile";
            studentForm.reset();
        }
    }

    function setCompanyFormMode(company = null) {
        const editing = Boolean(company && company._id);
        companyIdInput.value = company?._id || "";
        const title = document.querySelector("#company-dialog h2");
        const message = companyForm.querySelector(".dialog-message");
        title.textContent = editing ? "Edit company" : "Add company";
        message.textContent = "";
        message.classList.remove("is-success");
        if (editing) {
            document.querySelector("#company-name").value = company.name || "";
            document.querySelector("#company-location").value = company.location || "";
            document.querySelector("#company-role").value = company.jobRole || "";
            document.querySelector("#company-salary").value = company.salary ?? "";
            document.querySelector("#company-eligibility").value = company.eligibility || "";
        } else {
            companyForm.reset();
        }
    }

    function setDriveFormMode(drive = null) {
        const editing = Boolean(drive && drive._id);
        driveIdInput.value = drive?._id || "";
        const title = document.querySelector("#drive-dialog h2");
        const message = driveForm.querySelector(".dialog-message");
        title.textContent = editing ? "Edit placement drive" : "Add placement drive";
        message.textContent = "";
        message.classList.remove("is-success");
        if (editing) {
            document.querySelector("#drive-company").value = drive.company || drive.companyId || "";
            document.querySelector("#drive-date").value = drive.driveDate ? new Date(drive.driveDate).toISOString().split("T")[0] : "";
            document.querySelector("#drive-role").value = drive.jobRole || "";
            document.querySelector("#drive-eligibility").value = drive.eligibility || "";
        } else {
            driveForm.reset();
        }
    }

    function renderStats(stats) {
        document.querySelector("#total-students").textContent = stats.totalStudents;
        document.querySelector("#total-companies").textContent = stats.totalCompanies;
        document.querySelector("#total-drives").textContent = stats.totalDrives;
        document.querySelector("#students-placed").textContent = stats.studentsPlaced;
    }

    function renderRecentStudents(students) {
        const rows = document.querySelector("#recent-student-rows");
        rows.replaceChildren();

        if (!students.length) {
            const row = addText(rows, "tr", "empty-row", "");
            const cell = addText(row, "td", "empty-cell", "No students registered yet.");
            cell.colSpan = 4;
            return;
        }

        students.forEach((student) => {
            const row = document.createElement("tr");
            const nameCell = document.createElement("td");
            nameCell.className = "student-name-cell";
            const profileLink = document.createElement("a");
            profileLink.className = "student-name-link";
            profileLink.href = `/student-profile.html?id=${encodeURIComponent(student._id)}`;
            profileLink.textContent = student.name || "Unnamed student";
            nameCell.append(profileLink);
            row.append(nameCell);
            addText(row, "td", "student-email-cell", student.email || "No email");
            addText(row, "td", "", student.department || "Not specified");
            addText(row, "td", "student-date-cell", formatDate(student.registrationDate));
            rows.append(row);
        });
    }

    function renderDrives(drives) {
        const list = document.querySelector("#upcoming-drive-list");
        list.replaceChildren();

        if (!drives.length) {
            addText(list, "p", "empty-state", "No upcoming placement drives.");
            return;
        }

        drives.forEach((drive) => {
            const item = document.createElement("article");
            item.className = "drive-item";
            const heading = document.createElement("div");
            heading.className = "drive-item-heading";
            addText(heading, "h3", "", drive.companyName || "Company");
            addText(heading, "time", "drive-date", formatDate(drive.driveDate));
            item.append(heading);
            addText(item, "p", "drive-role", drive.jobRole || "Role not specified");
            const details = document.createElement("div");
            details.className = "drive-details";
            addText(details, "span", "drive-eligibility", drive.eligibility || "Eligibility not specified");
            addText(details, "span", "drive-status", drive.status || "Scheduled");
            item.append(details);
            list.append(item);
        });
    }

    function renderPlacementStatus(statuses) {
        const list = document.querySelector("#placement-status-list");
        const largest = Math.max(1, ...statusNames.map((status) => statuses[status] || 0));
        list.replaceChildren();

        statusNames.forEach((status) => {
            const row = document.createElement("div");
            row.className = "status-row";
            addText(row, "span", "status-name", status);
            const track = document.createElement("span");
            track.className = "status-track";
            const bar = document.createElement("span");
            bar.className = `status-bar status-${status.toLowerCase()}`;
            bar.style.width = `${Math.round((statuses[status] || 0) / largest * 100)}%`;
            track.append(bar);
            row.append(track);
            addText(row, "strong", "status-total", statuses[status] || 0);
            list.append(row);
        });
    }

    function renderMessages(containerSelector, messages, emptyText, className) {
        const container = document.querySelector(containerSelector);
        container.replaceChildren();

        if (!messages.length) {
            addText(container, "p", "empty-state", emptyText);
            return;
        }

        messages.forEach((item) => {
            const row = document.createElement("article");
            row.className = className;
            addText(row, "p", "message-copy", item.message);
            addText(row, "time", "message-date", formatDate(item.date));
            container.append(row);
        });
    }

    function renderOptions(select, items, getValue, getLabel) {
        const firstOption = select.querySelector("option:first-child") || document.createElement("option");
        select.replaceChildren(firstOption);
        items.forEach((item) => {
            const option = document.createElement("option");
            option.value = getValue(item);
            option.textContent = getLabel(item);
            select.append(option);
        });
    }

    function buildActionButtons(record, type) {
        const actions = document.createElement("div");
        actions.className = "table-actions";

        const viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "action-button action-view";
        viewButton.textContent = "View";
        viewButton.addEventListener("click", () => {
            if (type === "student") {
                window.location.assign(`/student-profile.html?id=${encodeURIComponent(record._id)}`);
            } else {
                openRecordView(type, record);
            }
        });

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "action-button action-edit";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => {
            if (type === "student") {
                setStudentFormMode(record);
                document.querySelector("#student-profiles").scrollIntoView({ behavior: "smooth", block: "start" });
            } else if (type === "company") {
                setCompanyFormMode(record);
                document.getElementById("company-dialog").showModal();
            } else if (type === "drive") {
                setDriveFormMode(record);
                document.getElementById("drive-dialog").showModal();
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "action-button action-delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
            const label = type === "student"
                ? (record.name || "this student")
                : type === "company"
                    ? (record.name || "this company")
                    : (record.companyName || "this drive");

            if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;

            const endpoint = type === "student"
                ? `/students/${record._id}`
                : type === "company"
                    ? `/companies/${record._id}`
                    : `/drives/${record._id}`;

            try {
                const response = await fetch(endpoint, { method: "DELETE" });
                const result = await response.text();
                if (!response.ok) throw new Error(result || "Unable to delete this record.");
                await loadDashboard();
                await loadDirectory();
            } catch (error) {
                alert(error.message || "Unable to delete the record.");
            }
        });

        actions.append(viewButton, editButton, deleteButton);
        return actions;
    }

    function renderStudentDirectory(students) {
        const rows = document.querySelector("#student-directory-rows");
        rows.replaceChildren();

        if (!students.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "empty-cell";
            cell.textContent = "No student records available.";
            row.append(cell);
            rows.append(row);
            return;
        }

        students.forEach((student) => {
            const row = document.createElement("tr");
            addText(row, "td", "student-name-cell", student.name || "Unnamed student");
            addText(row, "td", "", student.department || "Not specified");
            addText(row, "td", "", student.cgpa ?? "—");
            addText(row, "td", "", student.skills || "No skills listed");
            const actionsCell = document.createElement("td");
            actionsCell.append(buildActionButtons(student, "student"));
            row.append(actionsCell);
            rows.append(row);
        });
    }

    function renderCompanyDirectory(companies) {
        const rows = document.querySelector("#company-directory-rows");
        rows.replaceChildren();

        if (!companies.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 4;
            cell.className = "empty-cell";
            cell.textContent = "No companies added yet.";
            row.append(cell);
            rows.append(row);
            return;
        }

        companies.forEach((company) => {
            const row = document.createElement("tr");
            addText(row, "td", "student-name-cell", company.name || "Unnamed company");
            addText(row, "td", "", company.location || "Not specified");
            addText(row, "td", "", company.jobRole || "Not specified");
            const actionsCell = document.createElement("td");
            actionsCell.append(buildActionButtons(company, "company"));
            row.append(actionsCell);
            rows.append(row);
        });
    }

    function renderDriveDirectory(drives) {
        const rows = document.querySelector("#drive-directory-rows");
        rows.replaceChildren();

        if (!drives.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 5;
            cell.className = "empty-cell";
            cell.textContent = "No placement drives scheduled yet.";
            row.append(cell);
            rows.append(row);
            return;
        }

        drives.forEach((drive) => {
            const row = document.createElement("tr");
            addText(row, "td", "student-name-cell", drive.companyName || drive.company?.name || "Company");
            addText(row, "td", "", drive.jobRole || "Not specified");
            addText(row, "td", "", formatDate(drive.driveDate));
            addText(row, "td", "", drive.eligibility || "Not specified");
            const actionsCell = document.createElement("td");
            actionsCell.append(buildActionButtons(drive, "drive"));
            row.append(actionsCell);
            rows.append(row);
        });
    }

    function openRecordView(type, record) {
        const detailItems = [];
        if (type === "student") {
            detailItems.push(
                ["Name", record.name || "—"],
                ["Email", record.email || "—"],
                ["Department", record.department || "—"],
                ["CGPA", record.cgpa ?? "—"],
                ["Skills", record.skills || "—"],
                ["Registered", formatDate(record.registrationDate)]
            );
        } else if (type === "company") {
            detailItems.push(
                ["Company", record.name || "—"],
                ["Location", record.location || "—"],
                ["Job Role", record.jobRole || "—"],
                ["Salary", record.salary ? `₹${Number(record.salary).toLocaleString("en-IN")}` : "—"],
                ["Eligibility", record.eligibility || "—"],
                ["Added", formatDate(record.registrationDate)]
            );
        } else {
            detailItems.push(
                ["Company", record.companyName || record.company?.name || "—"],
                ["Job Role", record.jobRole || "—"],
                ["Drive Date", formatDate(record.driveDate)],
                ["Eligibility", record.eligibility || "—"],
                ["Status", record.status || "Scheduled"],
                ["Created", formatDate(record.registrationDate)]
            );
        }

        recordViewContent.replaceChildren();
        const grid = document.createElement("div");
        grid.className = "record-details-grid";

        detailItems.forEach(([label, value]) => {
            const item = document.createElement("div");
            item.className = "record-detail-item";
            addText(item, "span", "record-detail-label", label);
            addText(item, "strong", "record-detail-value", value);
            grid.append(item);
        });

        recordViewContent.append(grid);
        recordViewDialog.showModal();
    }

    async function loadDirectory() {
        const [studentsResponse, companiesResponse, drivesResponse] = await Promise.all([
            fetch("/students"),
            fetch("/companies"),
            fetch("/drives")
        ]);

        const [students, companies, drives] = await Promise.all([
            studentsResponse.json(),
            companiesResponse.json(),
            drivesResponse.json()
        ]);

        renderStudentDirectory(students);
        renderCompanyDirectory(companies);
        renderDriveDirectory(drives);
        renderOptions(
            document.querySelector("#eligibility-drive"),
            drives,
            (drive) => drive._id,
            (drive) => `${drive.companyName || drive.company?.name || "Company"} - ${drive.jobRole}`
        );
    }

    async function loadDashboard() {
        const refreshButton = document.querySelector("#refresh-button");
        const refreshStatus = document.querySelector("#refresh-status");
        refreshButton.disabled = true;
        refreshButton.textContent = "Refreshing...";
        refreshStatus.textContent = "";

        try {
            const [authResponse, dashboardResponse, studentsResponse] = await Promise.all([
                fetch("/api/auth/me"),
                fetch("/api/dashboard"),
                fetch("/students")
            ]);
            if (authResponse.status === 401) {
                sessionStorage.removeItem("cpmsSession");
                window.location.replace("/");
                return;
            }
            if (!authResponse.ok || !dashboardResponse.ok || !studentsResponse.ok) {
                throw new Error("Could not load the latest dashboard data.");
            }

            session = await authResponse.json();
            sessionStorage.setItem("cpmsSession", JSON.stringify(session));
            document.querySelector("#account-name").textContent = session.role === "admin" ? "Administrator" : "Placement Officer";
            document.querySelector("#admin-nav-link").hidden = session.role !== "admin";
            document.querySelector("#admin-tools").hidden = session.role !== "admin";
            const dashboard = await dashboardResponse.json();
            const students = await studentsResponse.json();
            renderStats(dashboard.stats);
            renderRecentStudents(dashboard.recentStudents);
            renderDrives(dashboard.upcomingDrives);
            renderPlacementStatus(dashboard.placementStatus);
            renderMessages("#recent-activity-list", dashboard.activity, "No recent activity.", "activity-item");
            renderMessages("#notification-list", dashboard.notifications, "No new notifications.", "notification-item");
            renderOptions(
                document.querySelector("#drive-company"),
                dashboard.companyOptions,
                (company) => company._id,
                (company) => company.name
            );
            renderOptions(
                document.querySelector("#status-student"),
                students,
                (student) => student._id,
                (student) => `${student.name || "Unnamed student"} (${student.email || "no email"})`
            );
            renderOptions(
                document.querySelector("#status-drive"),
                dashboard.driveOptions,
                (drive) => drive._id,
                (drive) => `${drive.companyName || "Company"} - ${drive.jobRole}`
            );
            await loadDirectory();
            await loadReports();
            if (session.role === "admin") await loadAdminTools();
            refreshStatus.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        } catch (error) {
            refreshStatus.textContent = error.message || "Refresh failed";
        } finally {
            refreshButton.disabled = false;
            refreshButton.textContent = "Refresh";
        }
    }

    studentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!studentForm.reportValidity()) return;

        const formData = new FormData(studentForm);
        const student = Object.fromEntries(formData.entries());
        delete student._id;
        student.cgpa = Number(student.cgpa);
        const isEditing = Boolean(studentIdInput.value);
        const endpoint = isEditing ? `/students/${studentIdInput.value}` : "/students";
        const method = isEditing ? "PUT" : "POST";
        saveButton.disabled = true;
        saveButton.textContent = isEditing ? "Updating..." : "Saving...";
        studentMessage.textContent = "";
        studentMessage.classList.remove("is-success");

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(student)
            });
            const result = (await response.text()).trim();
            if (!response.ok) throw new Error(result || "Could not save this student.");
            setStudentFormMode(null);
            studentMessage.textContent = result || (isEditing ? "Student profile updated." : "Student profile saved.");
            studentMessage.classList.add("is-success");
            await loadDashboard();
        } catch (error) {
            studentMessage.textContent = error.message || "Unable to reach the server. Please try again.";
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = studentIdInput.value ? "Update student profile" : "Save student profile";
        }
    });

    cancelStudentEditButton.addEventListener("click", () => {
        setStudentFormMode(null);
        studentMessage.textContent = "";
        studentMessage.classList.remove("is-success");
    });

    companyForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(companyForm);
        const company = Object.fromEntries(formData.entries());
        delete company._id;
        const isEditing = Boolean(companyIdInput.value);
        const endpoint = isEditing ? `/companies/${companyIdInput.value}` : "/companies";
        const method = isEditing ? "PUT" : "POST";
        const message = companyForm.querySelector(".dialog-message");
        const submitButton = companyForm.querySelector("button[type='submit']");
        submitButton.disabled = true;
        submitButton.textContent = isEditing ? "Updating..." : "Saving...";
        message.textContent = "";
        message.classList.remove("is-success");

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...company,
                    salary: company.salary ? Number(company.salary) : undefined
                })
            });
            const result = (await response.text()).trim();
            if (!response.ok) throw new Error(result || "Could not save this company.");
            companyForm.reset();
            setCompanyFormMode(null);
            companyForm.closest("dialog").close();
            message.textContent = result || (isEditing ? "Company updated." : "Company saved.");
            message.classList.add("is-success");
            await loadDashboard();
        } catch (error) {
            message.textContent = error.message || "Unable to reach the server.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isEditing ? "Save company" : "Save company";
        }
    });

    driveForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(driveForm);
        const drive = Object.fromEntries(formData.entries());
        delete drive._id;
        const isEditing = Boolean(driveIdInput.value);
        const endpoint = isEditing ? `/drives/${driveIdInput.value}` : "/drives";
        const method = isEditing ? "PUT" : "POST";
        const message = driveForm.querySelector(".dialog-message");
        const submitButton = driveForm.querySelector("button[type='submit']");
        submitButton.disabled = true;
        submitButton.textContent = isEditing ? "Updating..." : "Saving...";
        message.textContent = "";
        message.classList.remove("is-success");

        try {
            const response = await fetch(endpoint, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...drive,
                    driveDate: drive.driveDate ? new Date(drive.driveDate).toISOString() : null
                })
            });
            const result = (await response.text()).trim();
            if (!response.ok) throw new Error(result || "Could not save this drive.");
            driveForm.reset();
            setDriveFormMode(null);
            driveForm.closest("dialog").close();
            message.textContent = result || (isEditing ? "Placement drive updated." : "Placement drive saved.");
            message.classList.add("is-success");
            await loadDashboard();
        } catch (error) {
            message.textContent = error.message || "Unable to reach the server.";
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = isEditing ? "Save drive" : "Save drive";
        }
    });

    document.querySelector("#status-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        const message = form.querySelector(".dialog-message");
        const button = form.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = "Saving...";
        message.textContent = "";
        message.classList.remove("is-success");

        try {
            const response = await fetch("/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const result = (await response.text()).trim();
            if (!response.ok) throw new Error(result || "Could not save this status.");
            form.reset();
            form.closest("dialog").close();
            message.textContent = result || "Placement status saved.";
            message.classList.add("is-success");
            await loadDashboard();
        } catch (error) {
            message.textContent = error.message || "Unable to reach the server.";
        } finally {
            button.disabled = false;
            button.textContent = "Save status";
        }
    });

    document.querySelectorAll("[data-open-dialog]").forEach((button) => {
        button.addEventListener("click", () => document.getElementById(button.dataset.openDialog).showModal());
    });
    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => button.closest("dialog").close());
    });

    document.querySelector("#cancel-company-edit").addEventListener("click", () => {
        setCompanyFormMode(null);
        companyForm.closest("dialog").close();
    });

    document.querySelector("#cancel-drive-edit").addEventListener("click", () => {
        setDriveFormMode(null);
        driveForm.closest("dialog").close();
    });

    document.querySelector("#refresh-button").addEventListener("click", loadDashboard);

    document.querySelector("#eligibility-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const driveId = document.querySelector("#eligibility-drive").value;
        const feedback = document.querySelector("#eligibility-feedback");
        feedback.textContent = "Checking student records...";
        try {
            const response = await fetch(`/api/eligibility/${encodeURIComponent(driveId)}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Eligibility check failed.");
            window.currentEligibilityResult = result;
            document.querySelector("#eligibility-rows").dataset.driveId = driveId;
            renderEligibility(result);
            feedback.textContent = `${result.eligibleCount} of ${result.students.length} students meet this drive's listed criteria.`;
        } catch (error) {
            feedback.textContent = error.message || "Eligibility check failed.";
        }
    });
    document.querySelector("#eligible-only").addEventListener("change", () => {
        const selectedDrive = document.querySelector("#eligibility-drive").value;
        if (selectedDrive && document.querySelector("#eligibility-rows").dataset.driveId === selectedDrive) {
            renderEligibility(window.currentEligibilityResult);
        }
    });
    document.querySelector("#export-report-button").addEventListener("click", async () => {
        try {
            await exportReport();
        } catch (error) {
            document.querySelector("#report-generated").textContent = error.message;
        }
    });
    document.querySelector("#download-backup-button").addEventListener("click", async () => {
        const button = document.querySelector("#download-backup-button");
        button.disabled = true;
        try {
            const response = await fetch("/api/admin/backup");
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || "Backup export failed.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `cpms-backup-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            document.querySelector("#database-state").textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });

    document.querySelector("#dashboard-search").addEventListener("input", (event) => {
        clearTimeout(searchTimer);
        const query = event.currentTarget.value.trim();
        const results = document.querySelector("#search-results");
        const table = document.querySelector(".table-scroll");

        if (!query) {
            searchRequest += 1;
            results.hidden = true;
            results.replaceChildren();
            table.hidden = false;
            return;
        }

        const requestNumber = ++searchRequest;
        table.hidden = true;
        results.hidden = false;
        results.textContent = "Searching...";
        searchTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error("Search is unavailable.");
                const matches = await response.json();
                if (requestNumber !== searchRequest) return;
                results.replaceChildren();
                const entries = [
                    ...matches.students.map((student) => ({
                        group: "Students",
                        title: student.name || "Unnamed student",
                        detail: `${student.email || "No email"} - ${student.department || "No department"}`,
                        href: `/student-profile.html?id=${encodeURIComponent(student._id)}`
                    })),
                    ...matches.companies.map((company) => ({
                        group: "Companies",
                        title: company.name || "Unnamed company",
                        detail: [company.location, company.jobRole].filter(Boolean).join(" - ") || "Company profile"
                    }))
                ];

                if (!entries.length) {
                    addText(results, "p", "empty-state", "No students or companies match this search.");
                    return;
                }

                entries.forEach((entry) => {
                    const result = document.createElement(entry.href ? "a" : "div");
                    result.className = "search-result-item";
                    if (entry.href) result.href = entry.href;
                    const copy = document.createElement("div");
                    copy.className = "search-result-copy";
                    addText(copy, "strong", "", entry.title);
                    addText(copy, "span", "", entry.detail);
                    result.append(copy);
                    addText(result, "span", "search-result-type", entry.group);
                    results.append(result);
                });
            } catch (error) {
                if (requestNumber === searchRequest) results.textContent = error.message;
            }
        }, 180);
    });

    setStudentFormMode(null);
    setCompanyFormMode(null);
    setDriveFormMode(null);
    loadDashboard();
}