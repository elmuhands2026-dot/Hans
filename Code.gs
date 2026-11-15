/**
 * HANS LOGIN - Google Apps Script backend
 *
 * Script Properties required:
 *   SPREADSHEET_ID = Google Sheet ID
 *   WORKER_SECRET  = long random secret, same value stored as Worker secret GAS_SHARED_SECRET
 *
 * Deploy as Web app:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * The endpoint is intended to be called by your Cloudflare Worker only.
 * Never put WORKER_SECRET in frontend JavaScript or GitHub.
 */

const USERS_SHEET_NAME = "Users";
const SESSION_TTL_SECONDS = 3600;

function doGet() {
  return json_({ ok: false, message: "Hans Login API is running. Send POST requests." });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    verifyWorkerSecret_(body.workerSecret);

    switch (body.action) {
      case "login":
        return json_(login_(body.username, body.password));
      case "validateSession":
        return json_(validateSession_(body.token));
      case "logout":
        return json_(logout_(body.token));
      default:
        return json_({ ok: false, message: "طلب غير معروف." });
    }
  } catch (err) {
    // لا نرسل تفاصيل داخلية أو أسرارًا إلى العميل.
    console.error(err);
    return json_({ ok: false, message: "تعذر تنفيذ الطلب. راجع إعدادات الخادم." });
  }
}

function setupUsersSheet() {
  const sheet = getUsersSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["username", "salt", "passwordHash", "active", "createdAt"]);
    sheet.setFrozenRows(1);
  }
  return "Users sheet is ready.";
}

/**
 * Run manually once to create the first admin account.
 * Change these values before running. Then remove the password from source.
 */
function createInitialAdmin() {
  const username = "admin";                 // CHANGE
  const temporaryPassword = "ChangeMe-Now-2026!"; // CHANGE
  createUser_(username, temporaryPassword, true);
  return "Admin user created. Remove the temporary password from source now.";
}

/**
 * Optional helper for an administrator to add users manually from Apps Script.
 * Example: createUser_("staff01", "A-strong-password", true);
 */
function createUser_(username, password, active) {
  username = String(username || "").trim();
  password = String(password || "");

  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username)) {
    throw new Error("Username must be 3-80 characters: letters, numbers, dot, underscore, hyphen.");
  }
  if (password.length < 12) {
    throw new Error("Use a password of at least 12 characters.");
  }

  const sheet = getUsersSheet_();
  ensureHeader_(sheet);
  const rows = sheet.getDataRange().getValues();

  if (rows.slice(1).some(r => String(r[0]).toLowerCase() === username.toLowerCase())) {
    throw new Error("Username already exists.");
  }

  const salt = Utilities.getUuid() + Utilities.getUuid();
  const hash = hashPassword_(password, salt);
  sheet.appendRow([username, salt, hash, active === true, new Date()]);
  return "User created.";
}

function login_(username, password) {
  username = String(username || "").trim();
  password = String(password || "");

  if (!username || !password || username.length > 80 || password.length > 200) {
    return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const sheet = getUsersSheet_();
  ensureHeader_(sheet);
  const rows = sheet.getDataRange().getValues();
  const user = rows.slice(1).find(r =>
    String(r[0]).toLowerCase() === username.toLowerCase()
  );

  if (!user || user[3] !== true) {
    return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const supplied = hashPassword_(password, String(user[1]));
  if (!constantTimeEquals_(String(user[2]), supplied)) {
    return { ok: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة." };
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = {
    username: String(user[0]),
    createdAt: Date.now()
  };

  CacheService.getScriptCache().put(
    "hans_session_" + token,
    JSON.stringify(session),
    SESSION_TTL_SECONDS
  );

  return {
    ok: true,
    message: "تم تسجيل الدخول بنجاح.",
    token: token,
    username: String(user[0]),
    expiresInSeconds: SESSION_TTL_SECONDS
  };
}

function validateSession_(token) {
  token = String(token || "");
  if (!/^[a-f0-9-]{60,80}$/i.test(token)) return { ok: false };

  const cached = CacheService.getScriptCache().get("hans_session_" + token);
  if (!cached) return { ok: false };

  const session = JSON.parse(cached);
  return { ok: true, username: session.username };
}

function logout_(token) {
  token = String(token || "");
  if (/^[a-f0-9-]{60,80}$/i.test(token)) {
    CacheService.getScriptCache().remove("hans_session_" + token);
  }
  return { ok: true };
}

function verifyWorkerSecret_(received) {
  const expected = PropertiesService.getScriptProperties().getProperty("WORKER_SECRET");
  if (!expected || !received || !constantTimeEquals_(expected, String(received))) {
    throw new Error("Unauthorized worker request.");
  }
}

function getUsersSheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Missing SPREADSHEET_ID script property.");

  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(USERS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET_NAME);
    ensureHeader_(sheet);
  }
  return sheet;
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["username", "salt", "passwordHash", "active", "createdAt"]);
    sheet.setFrozenRows(1);
  }
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => {
    const v = (b + 256) % 256;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
}

function constantTimeEquals_(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}
