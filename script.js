/*
 * Hans Login - GitHub Pages frontend
 * ضع رابط Cloudflare Worker في API_URL بعد نشره.
 */
const API_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev";

const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const submitButton = document.getElementById("submitButton");
const statusMessage = document.getElementById("statusMessage");
const togglePasswordButton = document.getElementById("togglePassword");

document.getElementById("year").textContent = new Date().getFullYear();

function showMessage(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function getSavedToken() {
  return localStorage.getItem("hans_session") ||
         sessionStorage.getItem("hans_session");
}

function saveSession(token, username) {
  const remember = document.getElementById("rememberMe").checked;
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  other.removeItem("hans_session");
  other.removeItem("hans_username");
  store.setItem("hans_session", token);
  store.setItem("hans_username", username);
}

async function callApi(payload) {
  if (!API_URL || API_URL.includes("YOUR-WORKER-NAME")) {
    throw new Error("لم يتم ضبط رابط Cloudflare Worker داخل script.js.");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`تعذر الاتصال بالخادم (HTTP ${response.status}).`);
  }

  return response.json();
}

togglePasswordButton.addEventListener("click", () => {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  togglePasswordButton.textContent = show ? "إخفاء" : "إظهار";
  togglePasswordButton.setAttribute("aria-pressed", String(show));
  togglePasswordButton.setAttribute(
    "aria-label",
    show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
  );
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showMessage("من فضلك أدخل اسم المستخدم وكلمة المرور.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector(".button-label").textContent = "جارٍ التحقق...";
  showMessage("");

  try {
    const result = await callApi({
      action: "login",
      username,
      password
    });

    if (!result.ok) {
      showMessage(result.message || "بيانات الدخول غير صحيحة.", "error");
      return;
    }

    saveSession(result.token, result.username);
    showMessage("تم تسجيل الدخول بنجاح.", "success");

    // لاحقًا ضع رابط صفحة لوحة التحكم هنا بعد إنشائها.
    // مثال: window.location.href = "dashboard.html";
  } catch (error) {
    showMessage(error.message || "حدث خطأ غير متوقع.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector(".button-label").textContent = "تسجيل الدخول";
  }
});

document.getElementById("forgotPassword").addEventListener("click", () => {
  showMessage("يرجى التواصل مع مسؤول النظام لإعادة تعيين كلمة المرور.", "error");
});

/*
 * مثال للتحقق من جلسة محفوظة عند إضافة Dashboard:
 *
 * const result = await callApi({
 *   action: "validateSession",
 *   token: getSavedToken()
 * });
 *
 * if (!result.ok) {
 *   localStorage.removeItem("hans_session");
 *   sessionStorage.removeItem("hans_session");
 *   window.location.href = "index.html";
 * }
 */
