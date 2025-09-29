document.addEventListener("DOMContentLoaded", () => {
  // ================= FIREBASE INIT =================
  const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com", // ✅ fixed
    messagingSenderId: "761571632545",
    appId: "1:761571632545:web:547a7210fdebf366df97e0",
    measurementId: "G-309BJ6P79V"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();

  // ================= GOOGLE SIGN-IN =================
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  const googleSignInBtn = document.getElementById("google-signin");
  googleSignInBtn?.addEventListener("click", async () => {
    toggleLoading(true);
    try {
      const result = await auth.signInWithPopup(googleProvider);
      const user = result.user;
      localStorage.setItem(
        "userAuth",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: "google"
        })
      );
      showSuccess("Login successful! Redirecting...");
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } catch (err) {
      console.error(err);
      showError(getErrorMessage(err.code));
    } finally {
      toggleLoading(false);
    }
  });

  // ================= EMAIL LOGIN =================
  const loginForm = document.getElementById("login-form");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleLoading(true);

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const rememberMe = document.getElementById("remember").checked;

    if (!email || !password) {
      showError("Please fill in all fields");
      toggleLoading(false);
      return;
    }

    try {
      const persistence = rememberMe
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION;
      await auth.setPersistence(persistence);

      const { user } = await auth.signInWithEmailAndPassword(email, password);
      localStorage.setItem(
        "userAuth",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || email.split("@")[0],
          provider: "password"
        })
      );
      showSuccess("Login successful! Redirecting...");
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } catch (err) {
      console.error(err);
      showError(getErrorMessage(err.code));
    } finally {
      toggleLoading(false);
    }
  });

  // ================= SIGNUP =================
  const signupForm = document.getElementById("signup-form");
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    toggleLoading(true);

    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById(
      "signup-confirm-password"
    ).value;

    if (!email || !password || !confirmPassword) {
      showError("Please fill in all fields");
      toggleLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      showError("Passwords do not match");
      toggleLoading(false);
      return;
    }

    try {
      const { user } = await auth.createUserWithEmailAndPassword(
        email,
        password
      );
      localStorage.setItem(
        "userAuth",
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: email.split("@")[0],
          provider: "password"
        })
      );
      showSuccess("Signup successful! Redirecting...");
      setTimeout(() => (window.location.href = "dashboard.html"), 1000);
    } catch (err) {
      console.error(err);
      showError(getErrorMessage(err.code));
    } finally {
      toggleLoading(false);
    }
  });

  // ================= TOGGLE LOGIN/SIGNUP =================
  const toggleAuthLink = document.getElementById("toggle-auth-link");
  const formTitle = document.getElementById("form-title");
  const formSubtitle = document.getElementById("form-subtitle");
  const toggleAuthText = document.getElementById("toggle-auth-text");

  toggleAuthLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const isLogin = loginForm.style.display !== "none";
    loginForm.style.display = isLogin ? "none" : "block";
    signupForm.style.display = isLogin ? "block" : "none";
    formTitle.textContent = isLogin ? "Create an Account" : "Welcome Back";
    formSubtitle.textContent = isLogin
      ? "Join us and start organizing events today!"
      : "Let's get you back to creating amazing events!";
    toggleAuthText.innerHTML = isLogin
      ? `Have an account? <a href="#" id="toggle-auth-link">Log in</a>`
      : `Don't have an account? <a href="#" id="toggle-auth-link">Sign up</a>`;

    // rebind after replacing innerHTML
    document
      .getElementById("toggle-auth-link")
      .addEventListener("click", (ev) => {
        ev.preventDefault();
        toggleAuthLink.click();
      });
  });

  // ================= PASSWORD TOGGLE =================
  const togglePasswordBtn = document.getElementById("toggle-password");
  togglePasswordBtn?.addEventListener("click", () => {
    const passwordInput = document.getElementById("password");
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    togglePasswordBtn.textContent = type === "password" ? "Show" : "Hide";
  });

  // ================= HELPERS =================
  const loadingOverlay = document.getElementById("loading-overlay");
  const errorToast = document.getElementById("error-toast");

  function toggleLoading(show) {
    loadingOverlay.classList.toggle("active", show);
  }
  function showError(message) {
    errorToast.textContent = message;
    errorToast.classList.remove("success");
    errorToast.classList.add("error", "show");
    setTimeout(() => errorToast.classList.remove("show"), 3000);
  }
  function showSuccess(message) {
    errorToast.textContent = message;
    errorToast.classList.remove("error");
    errorToast.classList.add("success", "show");
    setTimeout(() => errorToast.classList.remove("show"), 3000);
  }
  function getErrorMessage(code) {
    const messages = {
      "auth/invalid-email": "Invalid email address",
      "auth/user-disabled": "This account has been disabled",
      "auth/user-not-found": "No account found with this email",
      "auth/wrong-password": "Incorrect password",
      "auth/email-already-in-use": "Email already registered",
      "auth/weak-password": "Password should be at least 6 characters",
      "auth/popup-closed-by-user": "Google sign-in cancelled",
      "auth/cancelled-popup-request": "Google sign-in cancelled",
      "auth/popup-blocked": "Google sign-in popup blocked",
      "auth/network-request-failed": "Network error. Please try again"
    };
    return messages[code] || "An error occurred. Please try again";
  }
});
