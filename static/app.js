const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const navLinks = document.querySelectorAll(".site-nav a");
const faqItems = document.querySelectorAll(".faq-item");
const requestForm = document.querySelector("#request-form");
const requestStatusBox = document.querySelector("#form-status");
const requestAuthBox = document.querySelector("#request-auth-box");
const requestActionButton = document.querySelector("#request-action-button");
const requestAuthModeToggle = document.querySelector("#request-auth-mode-toggle");
const requestAuthHelp = document.querySelector("#request-auth-help");
const requestAuthNameLabel = document.querySelector("#request-auth-name-label");
const requestFileInput = document.querySelector("#request-file-input");
const requestAttachmentsList = document.querySelector("#request-attachments-list");
const reviewForm = document.querySelector("#review-form");
const reviewStatusBox = document.querySelector("#review-status");
const reviewsList = document.querySelector("#reviews-list");
const worksList = document.querySelector("#works-list");
const footerCopyButton = document.querySelector(".footer-copy-button");
const footerCopyStatus = document.querySelector("#footer-copy-status");
const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const resetRequestForm = document.querySelector("#reset-request-form");
const resetConfirmForm = document.querySelector("#reset-confirm-form");
const resetPanel = document.querySelector("#reset-panel");
const authStatus = document.querySelector("#auth-status");
const authTabs = document.querySelectorAll(".account-tab");
const authPopover = document.querySelector("#auth-popover");
const openLoginButton = document.querySelector("#open-login-button");
const openRegisterButton = document.querySelector("#open-register-button");
const openResetButtons = document.querySelectorAll('[data-auth-tab="reset"]');
const headerSession = document.querySelector("#header-session");
const headerSessionName = document.querySelector("#header-session-name");
const profileAvatar = document.querySelector("#profile-avatar");
const profileToggleButton = document.querySelector("#profile-toggle-button");
const profileMenu = document.querySelector("#profile-menu");
const openChangePasswordButton = document.querySelector("#open-change-password-button");
const logoutButton = document.querySelector("#logout-button");
let currentUser = null;
let selectedRequestFiles = [];
let nextRequestFileId = 1;
const maxRequestFileCount = 10;
const maxRequestFileSize = 5 * 1024 * 1024;
const maxRequestFilesSize = 25 * 1024 * 1024;

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!expanded));
    siteNav.classList.toggle("is-open", !expanded);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle?.setAttribute("aria-expanded", "false");
    siteNav?.classList.remove("is-open");
  });
});

faqItems.forEach((item) => {
  const trigger = item.querySelector(".faq-question");
  trigger?.addEventListener("click", () => item.classList.toggle("is-open"));
});

function setStatus(node, message, isError = false) {
  if (!node) {
    return;
  }
  node.textContent = message;
  node.classList.toggle("is-error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function syncHeaderAuth(user) {
  const isAuthorized = Boolean(user);
  currentUser = user || null;
  openLoginButton?.classList.toggle("is-hidden", isAuthorized);
  openRegisterButton?.classList.toggle("is-hidden", isAuthorized);
  if (isAuthorized) {
    authPopover?.classList.add("is-hidden");
  } else {
    profileMenu?.classList.add("is-hidden");
    profileToggleButton?.setAttribute("aria-expanded", "false");
  }
  headerSession?.classList.toggle("is-hidden", !isAuthorized);
  requestAuthBox?.classList.toggle("is-hidden", isAuthorized);
  requestForm?.querySelectorAll(".request-contact-field").forEach((field) => {
    field.classList.toggle("is-hidden", isAuthorized);
    field.querySelectorAll("input").forEach((input) => {
      input.required = !isAuthorized;
    });
  });
  requestAuthBox?.querySelectorAll("input").forEach((input) => {
    input.required = !isAuthorized && (input.name !== "authName" || requestAuthBox?.dataset.authMode !== "login");
  });
  requestForm?.querySelectorAll("[name=\"name\"], [name=\"contact\"], [name=\"taskType\"], [name=\"antiPlagiarism\"], [name=\"deadline\"], [name=\"attachmentFile\"], [name=\"details\"]").forEach((field) => {
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.disabled = !isAuthorized;
    }
  });
  if (requestActionButton) {
    requestActionButton.type = isAuthorized ? "submit" : "button";
    requestActionButton.textContent = isAuthorized ? "Отправить заявку и перейти в чат" : (requestAuthBox?.dataset.authMode === "login" ? "Войти" : "Создать аккаунт");
  }
  requestAuthModeToggle?.classList.toggle("is-hidden", isAuthorized);
  requestAuthNameLabel?.classList.toggle("is-hidden", isAuthorized || requestAuthBox?.dataset.authMode === "login");
  if (headerSessionName) {
    headerSessionName.textContent = user?.name || "Пользователь";
  }
  if (profileAvatar) {
    const initial = (user?.name || "П").trim().charAt(0).toUpperCase() || "П";
    profileAvatar.textContent = initial;
  }
}

function setRequestAuthMode(mode) {
  if (!requestAuthBox) {
    return;
  }
  const isLogin = mode === "login";
  requestAuthBox.dataset.authMode = isLogin ? "login" : "register";
  if (requestAuthHelp) {
    requestAuthHelp.textContent = isLogin
      ? "Войдите в аккаунт, чтобы сохранить заявку и продолжить общение в чате."
      : "Создайте аккаунт, чтобы сохранить заявку и продолжить общение в чате.";
  }
  if (requestActionButton && !currentUser) {
    requestActionButton.textContent = isLogin ? "Войти" : "Создать аккаунт";
  }
  if (requestAuthModeToggle) {
    requestAuthModeToggle.textContent = isLogin ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти";
  }
  if (requestAuthNameLabel) {
    requestAuthNameLabel.classList.toggle("is-hidden", isLogin);
    requestAuthNameLabel.hidden = isLogin;
  }
  const authNameInput = requestAuthBox.querySelector('[name="authName"]');
  if (authNameInput instanceof HTMLInputElement) {
    authNameInput.required = !isLogin;
    authNameInput.disabled = isLogin;
  }
}

requestAuthModeToggle?.addEventListener("click", () => {
  setRequestAuthMode(requestAuthBox?.dataset.authMode === "login" ? "register" : "login");
  setStatus(requestStatusBox, "");
});

requestActionButton?.addEventListener("click", async () => {
  if (currentUser) {
    return;
  }
  if (!(requestForm instanceof HTMLFormElement)) {
    return;
  }
  const emailInput = requestForm.querySelector('[name="authEmail"]');
  const passwordInput = requestForm.querySelector('[name="authPassword"]');
  const nameInput = requestForm.querySelector('[name="authName"]');
  const email = emailInput instanceof HTMLInputElement ? emailInput.value.trim() : "";
  const password = passwordInput instanceof HTMLInputElement ? passwordInput.value : "";
  const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
  const mode = requestAuthBox?.dataset.authMode || "register";
  if (!email || !password || (mode === "register" && !name)) {
    setStatus(requestStatusBox, mode === "register"
      ? "Укажите имя, электронную почту и пароль для аккаунта."
      : "Укажите электронную почту и пароль.", true);
    return;
  }
  requestActionButton.disabled = true;
  setStatus(requestStatusBox, mode === "login" ? "Выполняю вход..." : "Создаю аккаунт...");
  try {
    const result = await fetchJson(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const requestNameInput = requestForm.querySelector('[name="name"]');
    if (requestNameInput instanceof HTMLInputElement) {
      requestNameInput.value = mode === "register" ? name : (result.user?.name || "");
    }
    syncHeaderAuth(result.user || null);
    setStatus(requestStatusBox, "Вы вошли. Заполните заявку и нажмите кнопку отправки — откроется чат.");
  } catch (error) {
    setStatus(requestStatusBox, error instanceof Error ? error.message : "Не удалось выполнить вход.", true);
  } finally {
    requestActionButton.disabled = false;
  }
});

function toggleProfileMenu(forceOpen) {
  if (!profileMenu || !profileToggleButton) {
    return;
  }
  const willOpen = typeof forceOpen === "boolean" ? forceOpen : profileMenu.classList.contains("is-hidden");
  profileMenu.classList.toggle("is-hidden", !willOpen);
  profileToggleButton.setAttribute("aria-expanded", String(willOpen));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const result = await response.json();
  if (!response.ok) {
    const message = result.errors ? Object.values(result.errors)[0] : result.message || "Не удалось выполнить запрос.";
    throw new Error(message);
  }
  return result;
}

function switchAuthTab(tabName) {
  authTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authTab === tabName));
  loginForm?.classList.toggle("is-hidden", tabName !== "login");
  registerForm?.classList.toggle("is-hidden", tabName !== "register");
  resetPanel?.classList.toggle("is-hidden", tabName !== "reset");
}

function openAuthPopover(tabName) {
  authPopover?.classList.remove("is-hidden");
  switchAuthTab(tabName);
}

async function handleJsonSubmit(form, url, statusNode, pendingMessage) {
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  setStatus(statusNode, pendingMessage);
  const result = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  form.reset();
  setStatus(statusNode, result.message || "");
  return result;
}

function renderReviews(items) {
  if (!reviewsList) {
    return;
  }
  reviewsList.innerHTML = items.length
    ? items.map((item) => `
      <article class="review-card">
        <p>"${escapeHtml(item.text)}"</p>
        <span>${escapeHtml(item.name)}, ${escapeHtml(item.role)}</span>
      </article>
    `).join("")
    : `
      <article class="review-card">
        <p>Пока нет опубликованных отзывов. Ваш отзыв может стать первым после модерации.</p>
        <span>Ожидаю новые отклики</span>
      </article>
    `;
}

function renderWorks(items) {
  if (!worksList) {
    return;
  }
  worksList.innerHTML = items.length
    ? items.map((item) => `
      <article class="portfolio-card">
        <p class="portfolio-type">${escapeHtml(item.workType || "Работа")}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="work-meta">
          <span>${escapeHtml(item.subject)}</span>
          ${item.originality ? `<span>${escapeHtml(item.originality)}</span>` : ""}
          ${item.tags ? `<span>${escapeHtml(item.tags)}</span>` : ""}
        </div>
        ${item.attachment?.path ? `
          <a class="chat-attachment work-download-link" href="${escapeHtml(item.attachment.path)}" target="_blank" rel="noopener noreferrer">
            <span>Файл</span>
            <strong>${escapeHtml(item.attachment.name)}</strong>
          </a>
        ` : ""}
      </article>
    `).join("")
    : `
      <article class="portfolio-card">
        <p class="portfolio-type">Работы</p>
        <h3>Каталог пополняется</h3>
        <p>Скоро здесь появятся примеры работ с направлением, типом проверки и кратким описанием результата.</p>
      </article>
    `;
}

async function loadWorks() {
  try {
    const result = await fetchJson("/api/works");
    renderWorks(result.items || []);
  } catch (error) {
    renderWorks([]);
  }
}

async function loadReviews() {
  try {
    const result = await fetchJson("/api/reviews");
    renderReviews(result.items || []);
  } catch (error) {
    renderReviews([]);
  }
}

async function restoreUserSession() {
  try {
    const result = await fetchJson("/api/auth/me");
    syncHeaderAuth(result.user || null);
  } catch (error) {
    syncHeaderAuth(null);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const contentBase64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        name: file.name,
        contentType: file.type || "application/octet-stream",
        contentBase64,
      });
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

function formatRequestFileSize(file) {
  return `${Math.max(1, Math.round(file.size / 1024))} КБ`;
}

function renderRequestAttachments() {
  if (!requestAttachmentsList) {
    return;
  }
  requestAttachmentsList.replaceChildren();
  if (!selectedRequestFiles.length) {
    const emptyLabel = document.createElement("span");
    emptyLabel.className = "attachment-name";
    emptyLabel.textContent = "Файлы не выбраны";
    requestAttachmentsList.appendChild(emptyLabel);
    return;
  }
  selectedRequestFiles.forEach(({ id, file }) => {
    const row = document.createElement("div");
    row.className = "request-attachment-item";
    const details = document.createElement("span");
    details.className = "request-attachment-details";
    details.textContent = `${file.name} · ${formatRequestFileSize(file)}`;
    const removeButton = document.createElement("button");
    removeButton.className = "request-attachment-remove";
    removeButton.type = "button";
    removeButton.dataset.fileId = String(id);
    removeButton.setAttribute("aria-label", `Удалить файл ${file.name}`);
    removeButton.textContent = "Удалить";
    row.append(details, removeButton);
    requestAttachmentsList.appendChild(row);
  });
}

requestFileInput?.addEventListener("change", () => {
  const files = Array.from(requestFileInput.files || []);
  const errors = [];
  files.forEach((file) => {
    if (file.size > maxRequestFileSize) {
      errors.push(`«${file.name}» больше 5 МБ`);
      return;
    }
    const duplicate = selectedRequestFiles.some((entry) =>
      entry.file.name === file.name && entry.file.size === file.size && entry.file.lastModified === file.lastModified
    );
    if (duplicate) {
      return;
    }
    if (selectedRequestFiles.length >= maxRequestFileCount) {
      errors.push("Можно приложить не больше 10 файлов");
      return;
    }
    const currentSize = selectedRequestFiles.reduce((total, entry) => total + entry.file.size, 0);
    if (currentSize + file.size > maxRequestFilesSize) {
      errors.push("Общий размер файлов не должен превышать 25 МБ");
      return;
    }
    selectedRequestFiles.push({ id: nextRequestFileId++, file });
  });
  requestFileInput.value = "";
  renderRequestAttachments();
  setStatus(requestStatusBox, errors.length ? errors.join(". ") : "");
});

requestAttachmentsList?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const removeButton = target.closest(".request-attachment-remove");
  if (!removeButton) {
    return;
  }
  const fileId = Number(removeButton.dataset.fileId);
  selectedRequestFiles = selectedRequestFiles.filter((entry) => entry.id !== fileId);
  renderRequestAttachments();
});

requestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus(requestStatusBox, "Сначала войдите или создайте аккаунт в этом разделе.", true);
    requestAuthBox?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  try {
    if (requestActionButton) {
      requestActionButton.disabled = true;
    }
    setStatus(requestStatusBox, selectedRequestFiles.length ? "Подготавливаю файлы и отправляю заявку..." : "Отправляю заявку...");
    const formData = new FormData(requestForm);
    const payload = Object.fromEntries(formData.entries());
    delete payload.attachmentFile;
    delete payload.authEmail;
    delete payload.authPassword;
    if (selectedRequestFiles.length) {
      payload.attachments = await Promise.all(selectedRequestFiles.map(({ file }) => fileToBase64(file)));
    }
    if (requestActionButton) {
      requestActionButton.textContent = "Отправляю заявку...";
    }
    setStatus(requestStatusBox, "Отправляю заявку и открываю чат...");
    const result = await fetchJson("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    requestForm.reset();
    selectedRequestFiles = [];
    renderRequestAttachments();
    setStatus(requestStatusBox, result.message || "Заявка отправлена.");
    window.location.assign(result.redirectTo || "/chat");
  } catch (error) {
    setStatus(requestStatusBox, error instanceof Error ? error.message : "Ошибка соединения.", true);
  } finally {
    if (requestActionButton) {
      requestActionButton.disabled = false;
      requestActionButton.textContent = currentUser ? "Отправить заявку и перейти в чат" : "Создать аккаунт";
    }
  }
});

reviewForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await handleJsonSubmit(reviewForm, "/api/reviews", reviewStatusBox, "Отправляю отзыв...");
  } catch (error) {
    setStatus(reviewStatusBox, error instanceof Error ? error.message : "Ошибка соединения.", true);
  }
});

footerCopyButton?.addEventListener("click", async () => {
  const email = footerCopyButton.getAttribute("data-copy-email") || "";
  try {
    await navigator.clipboard.writeText(email);
    setStatus(footerCopyStatus, "Почта скопирована.");
  } catch (error) {
    setStatus(footerCopyStatus, "Не удалось скопировать почту.", true);
  }
});

openLoginButton?.addEventListener("click", () => openAuthPopover("login"));
openRegisterButton?.addEventListener("click", () => openAuthPopover("register"));
openResetButtons.forEach((button) => button.addEventListener("click", () => openAuthPopover("reset")));
authTabs.forEach((tab) => tab.addEventListener("click", () => switchAuthTab(tab.dataset.authTab || "login")));
profileToggleButton?.addEventListener("click", () => toggleProfileMenu());
openChangePasswordButton?.addEventListener("click", () => {
  toggleProfileMenu(false);
  openAuthPopover("reset");
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !authPopover) {
    return;
  }
  const insideHeaderAuth = target.closest(".header-auth");
  if (insideHeaderAuth) {
    const insidePopover = target.closest("#auth-popover");
    const insideProfileMenu = target.closest("#profile-menu");
    const insideProfileToggle = target.closest("#profile-toggle-button");
    const insideOpenAuthButton = target.closest("#open-login-button") || target.closest("#open-register-button");
    if (!insidePopover && !insideProfileMenu && !insideProfileToggle && !insideOpenAuthButton) {
      authPopover.classList.add("is-hidden");
    }
    if (!insideProfileMenu && !insideProfileToggle) {
      toggleProfileMenu(false);
    }
    return;
  }
  authPopover.classList.add("is-hidden");
  toggleProfileMenu(false);
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await handleJsonSubmit(loginForm, "/api/auth/login", authStatus, "Выполняю вход...");
    syncHeaderAuth(result.user);
    window.location.href = "/chat";
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : "Неверный логин или пароль.", true);
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await handleJsonSubmit(registerForm, "/api/auth/register", authStatus, "Создаю аккаунт...");
    syncHeaderAuth(result.user);
    window.location.href = "/chat";
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : "Ошибка регистрации.", true);
  }
});

resetRequestForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await handleJsonSubmit(resetRequestForm, "/api/auth/password-reset/request", authStatus, "Отправляю код...");
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : "Ошибка отправки кода.", true);
  }
});

resetConfirmForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await handleJsonSubmit(resetConfirmForm, "/api/auth/password-reset/confirm", authStatus, "Меняю пароль...");
    switchAuthTab("login");
  } catch (error) {
    setStatus(authStatus, error instanceof Error ? error.message : "Ошибка восстановления.", true);
  }
});

logoutButton?.addEventListener("click", async () => {
  try {
    await fetchJson("/api/auth/logout", { method: "POST" });
  } catch (error) {
    // UI can still recover even if logout request fails.
  } finally {
    toggleProfileMenu(false);
    syncHeaderAuth(null);
    setStatus(authStatus, "");
  }
});

switchAuthTab("login");
restoreUserSession();
loadReviews();
loadWorks();
