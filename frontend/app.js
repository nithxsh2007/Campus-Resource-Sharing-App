const form = document.querySelector("#auth-form");
const nameField = document.querySelector("#name-field");
const nameInput = document.querySelector("#name");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const message = document.querySelector("#form-message");
const submitButton = document.querySelector("#submit-button");
const loginTab = document.querySelector("#login-tab");
const registerTab = document.querySelector("#register-tab");
const title = document.querySelector("#form-title");
const intro = document.querySelector("#form-intro");
const passwordHint = document.querySelector("#password-hint");

let mode = "login";

function setMode(nextMode) {
    mode = nextMode;
    const registering = mode === "register";

    nameField.hidden = !registering;
    nameInput.required = registering;
    passwordInput.autocomplete = registering ? "new-password" : "current-password";
    passwordHint.textContent = registering ? "At least 6 characters" : "Your account password";
    passwordInput.minLength = registering ? 6 : 0;
    loginTab.classList.toggle("is-active", !registering);
    registerTab.classList.toggle("is-active", registering);
    loginTab.setAttribute("aria-pressed", String(!registering));
    registerTab.setAttribute("aria-pressed", String(registering));
    title.textContent = registering ? "Create your account" : "Welcome back";
    intro.textContent = registering
        ? "Set up your account to access placement services."
        : "Sign in to continue to your placement workspace.";
    submitButton.textContent = registering ? "Create account" : "Sign in";
    message.textContent = "";
    message.classList.remove("is-success");
}

function showMessage(text, success = false) {
    message.textContent = text;
    message.classList.toggle("is-success", success);
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const registering = mode === "register";
    const endpoint = registering ? "/register" : "/login";
    const payload = {
        email: emailInput.value.trim(),
        password: passwordInput.value
    };

    if (registering) payload.name = nameInput.value.trim();

    submitButton.disabled = true;
    submitButton.textContent = registering ? "Creating account..." : "Signing in...";
    showMessage("");

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "The request could not be completed.");
        }

        if (registering && result.message === "Registration successful") {
            setMode("login");
            emailInput.value = payload.email;
            passwordInput.value = "";
            showMessage(result.role === "admin"
                ? "Administrator account created. Sign in with your new credentials."
                : "Placement officer account created. Sign in with your new credentials.", true);
        } else if (!registering && result.email) {
            sessionStorage.setItem("cpmsSession", JSON.stringify(result));
            window.location.assign("/dashboard.html");
        } else {
            showMessage(result.message || "The request could not be completed.");
        }
    } catch (error) {
        showMessage(error.message || "Unable to reach the server. Please try again.");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = mode === "register" ? "Create account" : "Sign in";
    }
});