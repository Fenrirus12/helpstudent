const chatUserList = document.querySelector("#chat-user-list");
const refreshChatListButton = document.querySelector("#refresh-chat-list-button");
const adminChatTitle = document.querySelector("#chat-admin-title");
const adminChatSubtitle = document.querySelector("#chat-admin-subtitle");
const adminChatMessages = document.querySelector("#admin-chat-messages");
const adminChatForm = document.querySelector("#admin-chat-form");
const adminChatStatus = document.querySelector("#admin-chat-status");
const adminChatFileInput = document.querySelector("#admin-chat-file-input");
const pendingFilesList = document.querySelector("#admin-pending-files");
const chatListSearch = document.querySelector("#chat-list-search");
const unreadOnly = document.querySelector("#chat-unread-only");
const chatListCount = document.querySelector("#chat-list-count");
const backToChatsButton = document.querySelector("#chat-back-button");
const chatAdminLayout = document.querySelector(".chat-admin-layout");
const messageSearch = document.querySelector("#admin-message-search");
const searchCount = document.querySelector("#admin-search-count");

let selectedUserId = "";
let adminChatPollTimer = null;
let lastChatsSnapshot = [];
let renderedMessages = [];
let matchingMessages = [];
let activeMatchIndex = -1;
const defaultTitle = document.title;
const attachmentQueue = new window.ChatAttachmentQueue(adminChatFileInput, pendingFilesList, adminChatStatus);

function getAdminAuth() {
  return window.localStorage.getItem("adminAuth") || "";
}

function setStatus(node, message, isError = false) {
  if (!node) return;
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

function formatDate(value) {
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(parsedDate);
}

function getLastMessagePreview(message) {
  if (!message) return "Сообщений пока нет";
  if (message.text) return message.text;
  const attachments = message.attachments || (message.attachment ? [message.attachment] : []);
  if (attachments.length) return attachments.length === 1 ? `Файл: ${attachments[0].name}` : `Файлов: ${attachments.length}`;
  return "Новое сообщение";
}

async function adminFetch(url, options = {}) {
  const auth = getAdminAuth();
  if (!auth) throw new Error("Войдите в админку на странице /admin.");
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Basic ${auth}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Не удалось выполнить запрос.");
  return result;
}

function updateDocumentTitle(items) {
  const unreadTotal = items.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
  document.title = unreadTotal > 0 ? `(${unreadTotal}) ${defaultTitle}` : defaultTitle;
}

function renderChatList() {
  if (!chatUserList) return;
  const query = String(chatListSearch?.value || "").trim().toLocaleLowerCase("ru");
  const unreadFilter = Boolean(unreadOnly?.checked);
  const items = lastChatsSnapshot.filter((item) => {
    if (unreadFilter && Number(item.unreadCount || 0) === 0) return false;
    if (!query) return true;
    const lastAttachments = item.lastMessage?.attachments || (item.lastMessage?.attachment ? [item.lastMessage.attachment] : []);
    const searchText = `${item.user.name} ${item.user.email} ${getLastMessagePreview(item.lastMessage)} ${lastAttachments.map((file) => file.name || "").join(" ")}`.toLocaleLowerCase("ru");
    return searchText.includes(query);
  });
  const unreadTotal = lastChatsSnapshot.reduce((sum, item) => sum + Number(item.unreadCount || 0), 0);
  if (chatListCount) chatListCount.textContent = `${items.length} из ${lastChatsSnapshot.length} диалогов · ${unreadTotal} непрочитанных`;
  if (!items.length) {
    chatUserList.innerHTML = `<div class="chat-empty">${lastChatsSnapshot.length ? "По этому запросу диалоги не найдены." : "Пока нет зарегистрированных пользователей с чатами."}</div>`;
    return;
  }
  chatUserList.innerHTML = items.map((item) => `
    <button class="chat-user-item ${selectedUserId === String(item.user.id) ? "is-active" : ""}" type="button" data-user-id="${escapeHtml(item.user.id)}">
      <span class="chat-user-item-head"><strong>${escapeHtml(item.user.name)}</strong>${Number(item.unreadCount || 0) > 0 ? `<span class="chat-unread-badge">${escapeHtml(item.unreadCount)}</span>` : ""}</span>
      <span>${escapeHtml(item.user.email)}</span>
      <small>${escapeHtml(getLastMessagePreview(item.lastMessage))}</small>
      <small class="chat-user-last-seen">${escapeHtml(item.lastMessage ? formatDate(item.lastMessage.createdAt) : "Новый диалог")}</small>
    </button>
  `).join("");
}

function renderAttachments(item, canDelete) {
  const attachments = Array.isArray(item.attachments) && item.attachments.length
    ? item.attachments
    : (item.attachment ? [item.attachment] : []);
  return attachments.map((attachment, index) => `
    <div class="chat-attachment-row">
      <a class="chat-attachment" href="${escapeHtml(attachment.path)}" target="_blank" rel="noopener noreferrer">
        <span>Вложение</span><strong>${escapeHtml(attachment.name)}</strong>
        <small>${Math.max(1, Math.round(Number(attachment.size || 0) / 1024))} КБ</small>
      </a>
      ${canDelete && index === 0 ? `<button class="chat-message-delete" type="button" data-delete-message="${escapeHtml(item.id)}" aria-label="Удалить сообщение вместе с файлами">Удалить сообщение</button>` : ""}
    </div>
  `).join("");
}

function applyMessageSearch() {
  if (!adminChatMessages) return;
  const query = String(messageSearch?.value || "").trim().toLocaleLowerCase("ru");
  matchingMessages = [];
  const articles = [...adminChatMessages.querySelectorAll(".chat-message")];
  articles.forEach((article, index) => {
    const message = renderedMessages[index];
    const attachments = message?.attachments || (message?.attachment ? [message.attachment] : []);
    const haystack = `${message?.text || ""} ${attachments.map((item) => item.name || "").join(" ")}`.toLocaleLowerCase("ru");
    const matches = !query || haystack.includes(query);
    article.classList.toggle("is-search-muted", Boolean(query) && !matches);
    article.classList.toggle("is-search-match", Boolean(query) && matches);
    article.classList.remove("is-current-match");
    if (query && matches) matchingMessages.push(article);
  });
  activeMatchIndex = matchingMessages.length ? Math.min(activeMatchIndex, matchingMessages.length - 1) : -1;
  if (searchCount) searchCount.textContent = query ? `${matchingMessages.length} совпадений` : "";
}

function stepSearch(direction) {
  if (!matchingMessages.length) return;
  const startIndex = activeMatchIndex < 0 ? (direction > 0 ? -1 : 0) : activeMatchIndex;
  activeMatchIndex = (startIndex + direction + matchingMessages.length) % matchingMessages.length;
  matchingMessages.forEach((message, index) => message.classList.toggle("is-current-match", index === activeMatchIndex));
  matchingMessages[activeMatchIndex].scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderAdminMessages(items) {
  if (!adminChatMessages) return;
  const wasAtBottom = adminChatMessages.scrollHeight - adminChatMessages.scrollTop - adminChatMessages.clientHeight < 72;
  const previousTop = adminChatMessages.scrollTop;
  renderedMessages = items;
  if (!items.length) {
    adminChatMessages.innerHTML = `<div class="chat-empty">В этом чате пока нет сообщений.</div>`;
  } else {
    adminChatMessages.innerHTML = items.map((item) => `
      <article class="chat-message chat-message-${escapeHtml(item.sender)}" data-message-id="${escapeHtml(item.id)}">
        <div class="chat-message-meta"><span>${item.sender === "admin" ? "Администратор" : "Пользователь"}</span><span>${escapeHtml(formatDate(item.createdAt))}</span></div>
        ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ""}
        ${renderAttachments(item, item.sender === "admin" && Boolean(item.attachments?.length || item.attachment))}
      </article>
    `).join("");
  }
  if (wasAtBottom) adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
  else adminChatMessages.scrollTop = Math.min(previousTop, adminChatMessages.scrollHeight - adminChatMessages.clientHeight);
  applyMessageSearch();
}

async function loadChatList() {
  if (!getAdminAuth()) {
    if (chatUserList) chatUserList.innerHTML = `<div class="chat-empty">Сначала войдите в админку на странице /admin.</div>`;
    lastChatsSnapshot = [];
    if (chatListCount) chatListCount.textContent = "";
    updateDocumentTitle([]);
    return;
  }
  try {
    const result = await adminFetch("/api/admin/chats");
    lastChatsSnapshot = result.items || [];
    updateDocumentTitle(lastChatsSnapshot);
    renderChatList();
  } catch (error) {
    updateDocumentTitle([]);
    if (chatUserList) chatUserList.innerHTML = `<div class="chat-empty">${escapeHtml(error instanceof Error ? error.message : "Ошибка загрузки чатов.")}</div>`;
  }
}

async function loadSelectedChat() {
  if (!selectedUserId) {
    renderAdminMessages([]);
    return;
  }
  try {
    const result = await adminFetch(`/api/admin/chats/${selectedUserId}/messages`);
    renderAdminMessages(result.items || []);
  } catch (error) {
    setStatus(adminChatStatus, error instanceof Error ? error.message : "Ошибка загрузки сообщений.", true);
  }
}

function selectUser(userId) {
  selectedUserId = userId;
  const selectedChat = lastChatsSnapshot.find((item) => String(item.user.id) === String(userId));
  if (adminChatTitle) adminChatTitle.textContent = selectedChat?.user?.name || "Пользователь";
  if (adminChatSubtitle) adminChatSubtitle.textContent = selectedChat?.user?.email || "";
  if (adminChatForm) adminChatForm.classList.remove("is-hidden");
  chatAdminLayout?.classList.add("chat-admin-has-selection");
  if (messageSearch) messageSearch.value = "";
  setStatus(adminChatStatus, "");
  renderChatList();
  loadChatList();
  loadSelectedChat();
}

function showChatList() {
  selectedUserId = "";
  chatAdminLayout?.classList.remove("chat-admin-has-selection");
  adminChatForm?.classList.add("is-hidden");
  if (adminChatTitle) adminChatTitle.textContent = "Выберите пользователя";
  if (adminChatSubtitle) adminChatSubtitle.textContent = "Пока диалог не выбран.";
  renderAdminMessages([]);
  renderChatList();
}

function startAdminChatPolling() {
  stopAdminChatPolling();
  adminChatPollTimer = window.setInterval(() => {
    loadChatList();
    loadSelectedChat();
  }, 5000);
}

function stopAdminChatPolling() {
  if (!adminChatPollTimer) return;
  window.clearInterval(adminChatPollTimer);
  adminChatPollTimer = null;
}

async function deleteMessage(messageId) {
  if (!window.confirm("Удалить сообщение целиком вместе с прикреплёнными файлами?")) return;
  try {
    await adminFetch(`/api/admin/chats/${selectedUserId}/messages/${messageId}`, { method: "DELETE" });
    setStatus(adminChatStatus, "Сообщение удалено.");
    await loadSelectedChat();
  } catch (error) {
    setStatus(adminChatStatus, error instanceof Error ? error.message : "Не удалось удалить сообщение.", true);
  }
}

chatUserList?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest(".chat-user-item");
  const userId = button?.getAttribute("data-user-id");
  if (userId) selectUser(userId);
});

refreshChatListButton?.addEventListener("click", () => {
  loadChatList();
  loadSelectedChat();
});
chatListSearch?.addEventListener("input", renderChatList);
unreadOnly?.addEventListener("change", renderChatList);
backToChatsButton?.addEventListener("click", showChatList);
messageSearch?.addEventListener("input", () => {
  activeMatchIndex = -1;
  applyMessageSearch();
});
document.querySelector("#admin-search-prev")?.addEventListener("click", () => stepSearch(-1));
document.querySelector("#admin-search-next")?.addEventListener("click", () => stepSearch(1));
document.querySelector("#admin-latest-button")?.addEventListener("click", () => {
  if (adminChatMessages) adminChatMessages.scrollTo({ top: adminChatMessages.scrollHeight, behavior: "smooth" });
});

adminChatMessages?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest("[data-delete-message]");
  const messageId = button?.getAttribute("data-delete-message");
  if (messageId) deleteMessage(messageId);
});

adminChatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedUserId) {
    setStatus(adminChatStatus, "Сначала выберите пользователя.", true);
    return;
  }
  const text = String(new FormData(adminChatForm).get("text") || "").trim();
  if (!text && !attachmentQueue.files.length) {
    setStatus(adminChatStatus, "Введите сообщение или прикрепите файл.", true);
    return;
  }
  const submitButton = adminChatForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setStatus(adminChatStatus, "Подготавливаю ответ...");
  try {
    const attachments = await attachmentQueue.toPayloads();
    await adminFetch(`/api/admin/chats/${selectedUserId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, attachments }),
    });
    adminChatForm.reset();
    attachmentQueue.clear();
    setStatus(adminChatStatus, "Ответ отправлен.");
    await loadSelectedChat();
  } catch (error) {
    setStatus(adminChatStatus, error instanceof Error ? error.message : "Ошибка отправки ответа.", true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

loadChatList();
startAdminChatPolling();
