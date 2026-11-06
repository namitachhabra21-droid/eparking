import { post, api } from "../core/api.js";
import { esc } from "../core/ui.js";
export async function signIn(onDone) {
  document.querySelector("#boot")?.remove();
  let mode = "login";
  const root = document.createElement("main");
  root.className = "auth-page";
  document.body.append(root);
  function paint() {
    root.innerHTML = `<section class="auth-brand"><a class="auth-wordmark" href="/">P<span>ParkFlow</span></a><div><span class="auth-eyebrow">YOUR PARKING OPERATIONS, CONNECTED</span><h1>A clearer view.<br>A smoother stay.</h1><p>Manage every bay, booking and arrival from one workspace.</p><div class="auth-pills"><span>Live availability</span><span>Secure records</span><span>Multi-facility</span></div></div><small>eParking Management System · Manipal University Jaipur</small></section><section class="auth-panel"><div class="auth-form"><div class="auth-tabs"><button data-mode="login" class="${mode === "login" ? "on" : ""}">Sign in</button><button data-mode="register" class="${mode === "register" ? "on" : ""}">Create workspace</button></div><h2>${mode === "login" ? "Welcome back" : "Make room for better parking"}</h2><p class="t2">${mode === "login" ? "Sign in to your parking operations workspace." : "Create an account and start managing your facilities."}</p><form id="auth-form">${mode === "register" ? '<label class="lbl" for="auth-name">Your name</label><input class="field" id="auth-name" name="name" minlength="2" maxlength="100" autocomplete="name" required><label class="lbl" for="auth-org">Organization</label><input class="field" id="auth-org" name="organization" minlength="2" maxlength="120" autocomplete="organization" required>' : ""}<label class="lbl" for="auth-email">Email address</label><input class="field" id="auth-email" name="email" type="email" autocomplete="email" maxlength="200" required><label class="lbl" for="auth-pass">Password</label><input class="field" id="auth-pass" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" minlength="12" maxlength="128" required><p class="fs12 t3">Use at least 12 characters.</p><p id="auth-error" role="alert" class="form-error"></p><button class="btn btn-primary btn-block" type="submit">${mode === "login" ? "Sign in" : "Create workspace"} <span aria-hidden="true">→</span></button></form><p class="auth-note">Your workspace starts with four configurable facilities. Only your team can access your records.</p><a class="fs12 t3" href="https://github.com/namitachhabra21-droid/eparking" target="_blank" rel="noopener">View project on GitHub ↗</a></div></section>`;
    root.querySelectorAll("[data-mode]").forEach(
      (b) =>
        (b.onclick = () => {
          mode = b.dataset.mode;
          paint();
        }),
    );
    root.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      const b = e.target.querySelector("[type=submit]");
      b.disabled = true;
      b.textContent = "Please wait…";
      const values = Object.fromEntries(new FormData(e.target));
      try {
        await post("/auth/" + mode, values);
        root.remove();
        await onDone();
      } catch (error) {
        root.querySelector("#auth-error").textContent = error.message;
        b.disabled = false;
        b.textContent = mode === "login" ? "Sign in" : "Create workspace";
      }
    };
  }
  paint();
}
export async function restoreSession() {
  try {
    return await api("/auth/me");
  } catch (e) {
    if (e.status === 401) return null;
    throw e;
  }
}
