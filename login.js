// Wait for Firebase to load
window.addEventListener('load', () => {
  console.log('Page loaded, checking Firebase...');
  
  // Check if Firebase is loaded
  if (typeof firebase === 'undefined') {
    console.error('Firebase not loaded!');
    showError('Failed to load Firebase. Please refresh the page.');
    return;
  }
  
  console.log('Firebase loaded successfully');
  
  // ================= FIREBASE INIT =================
  const firebaseConfig = {
    apiKey: "AIzaSyCKd_iH-McAMrKI_0YDoYG0xjn2KrQpTOQ",
    authDomain: "notifyme-events.firebaseapp.com",
    projectId: "notifyme-events",
    storageBucket: "notifyme-events.appspot.com",
    messagingSenderId: "761571632545",
    appId: "1:761571632545:web:547a7210fdebf366df97e0",
    measurementId: "G-309BJ6P79V"
  };

  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized');
  }

  const auth = firebase.auth();

  // ================= HELPER FUNCTIONS =================
  const loadingOverlay = document.getElementById("loading-overlay");
  const errorToast = document.getElementById("error-toast");

  function toggleLoading(show) {
    if (loadingOverlay) {
      loadingOverlay.classList.toggle("active", show);
    }
  }
  
  function showError(message) {
    if (errorToast) {
      errorToast.textContent = message;
      errorToast.classList.remove("success");
      errorToast.classList.add("error", "show");
      setTimeout(() => errorToast.classList.remove("show"), 3000);
    }
    console.error(message);
  }
  
  function showSuccess(message) {
    if (errorToast) {
      errorToast.textContent = message;
      errorToast.classList.remove("error");
      errorToast.classList.add("success", "show");
      setTimeout(() => errorToast.classList.remove("show"), 3000);
    }
    console.log(message);
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
      "auth/popup-blocked": "Google sign-in popup blocked. Please allow popups for this site.",
      "auth/network-request-failed": "Network error. Please check your connection and try again",
      "auth/invalid-credential": "Invalid email or password"
    };
    return messages[code] || `An error occurred: ${code}`;
  }

  // ================= GOOGLE SIGN-IN =================
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  const googleSignInBtn = document.getElementById("google-signin");
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", async () => {
      console.log('Google sign-in clicked');
      toggleLoading(true);
      try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        console.log('Google sign-in successful:', user.email);
        
        // Store in sessionStorage as fallback
        sessionStorage.setItem('userAuth', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          provider: "google"
        }));
        
        showSuccess("Login successful! Redirecting...");
        setTimeout(() => (window.location.href = "dashboard.html"), 1000);
      } catch (err) {
        console.error('Google sign-in error:', err);
        showError(getErrorMessage(err.code));
      } finally {
        toggleLoading(false);
      }
    });
  }

  // ================= EMAIL LOGIN =================
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log('Login form submitted');
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

        const result = await auth.signInWithEmailAndPassword(email, password);
        const user = result.user;
        console.log('Email login successful:', user.email);
        
        // Store in sessionStorage as fallback
        sessionStorage.setItem('userAuth', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || email.split("@")[0],
          provider: "password"
        }));
        
        showSuccess("Login successful! Redirecting...");
        setTimeout(() => (window.location.href = "dashboard.html"), 1000);
      } catch (err) {
        console.error('Login error:', err);
        showError(getErrorMessage(err.code));
      } finally {
        toggleLoading(false);
      }
    });
  }

  // ================= SIGNUP =================
  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log('Signup form submitted');
      toggleLoading(true);

      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      const confirmPassword = document.getElementById("signup-confirm-password").value;

      if (!email || !password || !confirmPassword) {
        showError("Please fill in all fields");
        toggleLoading(false);
        return;
      }
      
      if (password.length < 6) {
        showError("Password should be at least 6 characters");
        toggleLoading(false);
        return;
      }
      
      if (password !== confirmPassword) {
        showError("Passwords do not match");
        toggleLoading(false);
        return;
      }

      try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;
        console.log('Signup successful:', user.email);
        
        // Store in sessionStorage as fallback
        sessionStorage.setItem('userAuth', JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: email.split("@")[0],
          provider: "password"
        }));
        
        showSuccess("Signup successful! Redirecting...");
        setTimeout(() => (window.location.href = "dashboard.html"), 1000);
      } catch (err) {
        console.error('Signup error:', err);
        showError(getErrorMessage(err.code));
      } finally {
        toggleLoading(false);
      }
    });
  }

  // ================= TOGGLE LOGIN/SIGNUP =================
  const toggleAuthLink = document.getElementById("toggle-auth-link");
  const formTitle = document.getElementById("form-title");
  const formSubtitle = document.getElementById("form-subtitle");
  const toggleMessage = document.getElementById("toggle-message");

  if (toggleAuthLink) {
    toggleAuthLink.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('Toggle auth clicked');
      
      const isLogin = loginForm.style.display !== "none";
      
      loginForm.style.display = isLogin ? "none" : "block";
      signupForm.style.display = isLogin ? "block" : "none";
      
      formTitle.textContent = isLogin ? "Create an Account" : "Welcome Back";
      formSubtitle.textContent = isLogin
        ? "Join us and start organizing events today!"
        : "Let's get you back to creating amazing events!";
      
      toggleMessage.textContent = isLogin ? "Have an account?" : "Don't have an account?";
      toggleAuthLink.textContent = isLogin ? "Log in" : "Sign up";
    });
  }

  // ================= PASSWORD TOGGLE =================
  const togglePasswordBtn = document.getElementById("toggle-password");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      const passwordInput = document.getElementById("password");
      const type = passwordInput.type === "password" ? "text" : "password";
      passwordInput.type = type;
      togglePasswordBtn.textContent = type === "password" ? "Show" : "Hide";
    });
  }

  console.log('All event listeners attached successfully');
});