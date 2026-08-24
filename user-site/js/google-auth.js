// Real "Sign in with Google" wiring, shared by register.html and
// login.html. Renders Google's own button (via Google Identity Services)
// once GOOGLE_CLIENT_ID is configured - see js/config.js. Until then, the
// container stays in its honest "not configured yet" state rather than
// showing a button that doesn't actually do anything.
function initGoogleSignIn(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!GOOGLE_CLIENT_ID) {
    return; // Container already shows the disabled/coming-soon markup.
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });

    container.innerHTML = "";
    google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      width: container.offsetWidth || 240,
      text: "continue_with",
    });
  };
  document.head.appendChild(script);
}

async function handleGoogleCredential(response) {
  const errorEl = document.getElementById("register-error") || document.getElementById("login-error");

  try {
    const res = await Api.post("/auth/google", {
      credential: response.credential,
    });
    Api.setToken(res.token);
    window.location.href = "dashboard.html";
  } catch (err) {
    if (errorEl) {
      errorEl.innerHTML = `<p class="alert alert-error">${Util.escapeHtml(err.message)}</p>`;
    }
  }
}
