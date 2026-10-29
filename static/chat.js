const userName = document.querySelector("#user-name");
const userLogoutButton = document.querySelector("#user-logout-button");
const userChatMessages = document.querySelector("#user-chat-messages");
const userChatForm = document.querySelector("#user-chat-form");
const chatStatus = document.querySelector("#chat-status");
const chatFileInput = document.querySelector("#chat-file-input");
const pendingFilesList = document.querySelector("#user-pending-files");
const messageSearch = document.querySelector("#user-message-search");
const searchCount = document.querySelector("#user-search-count");
const latestButton = document.querySelector("#user-latest-button");

let chatPollTimer = null;
let renderedMessages = [];
let matchingMessages = [];
let activeMatchIndex = -1;
const attachmentQueue = new window.ChatAttachmentQueue(chatFileInput, pendingFilesList, chatStatus);

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

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.headers || {}) },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Не удалось выполнить запрос.");
  return result;
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
  if (!userChatMessages) return;
  const query = String(messageSearch?.value || "").trim().toLocaleLowerCase("ru");
  matchingMessages = [];
  const articles = [...userChatMessages.querySelectorAll(".chat-message")];
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

function renderMessages(items) {
  if (!userChatMessages) return;
  const wasAtBottom = userChatMessages.scrollHeight - userChatMessages.scrollTop - userChatMessages.clientHeight < 72;
  const previousTop = userChatMessages.scrollTop;
  renderedMessages = items;
  if (!items.length) {
    userChatMessages.innerHTML = `<div class="chat-empty">Сообщений пока нет. Напишите администратору первым.</div>`;
  } else {
    userChatMessages.innerHTML = items.map((item) => `
      <article class="chat-message chat-message-${escapeHtml(item.sender)}" data-message-id="${escapeHtml(item.id)}">
        <div class="chat-message-meta"><span>${item.sender === "admin" ? "Администратор" : "Вы"}</span><span>${escapeHtml(formatDate(item.createdAt))}</span></div>
        ${item.text ? `<p>${escapeHtml(item.text)}</p>` : ""}
        ${renderAttachments(item, item.sender === "user" && Boolean(item.attachments?.length || item.attachment))}
      </article>
    `).join("");
  }
  if (wasAtBottom) userChatMessages.scrollTop = userChatMessages.scrollHeight;
  else userChatMessages.scrollTop = Math.min(previousTop, userChatMessages.scrollHeight - userChatMessages.clientHeight);
  applyMessageSearch();
}

async function ensureAuthorizedUser() {
  try {
    const result = await fetchJson("/api/auth/me");
    if (userName) userName.textContent = result.user?.name || "Пользователь";
  } catch {
    window.location.replace("/");
  }
}

async function loadMessages() {
  try {
    const result = await fetchJson("/api/chat/messages");
    renderMessages(result.items || []);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("авториза") || error.message.includes("Сессия"))) {
      window.location.replace("/");
      return;
    }
    setStatus(chatStatus, error instanceof Error ? error.message : "Ошибка загрузки сообщений.", true);
  }
}

function startPolling() {
  stopPolling();
  chatPollTimer = window.setInterval(loadMessages, 4000);
}

function stopPolling() {
  if (!chatPollTimer) return;
  window.clearInterval(chatPollTimer);
  chatPollTimer = null;
}

async function deleteMessage(messageId) {
  if (!window.confirm("Удалить сообщение целиком вместе с прикреплёнными файлами?")) return;
  try {
    await fetchJson(`/api/chat/messages/${messageId}`, { method: "DELETE" });
    setStatus(chatStatus, "Сообщение удалено.");
    await loadMessages();
  } catch (error) {
    setStatus(chatStatus, error instanceof Error ? error.message : "Не удалось удалить сообщение.", true);
  }
}

userChatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = String(new FormData(userChatForm).get("text") || "").trim();
  if (!text && !attachmentQueue.files.length) {
    setStatus(chatStatus, "Введите сообщение или прикрепите файл.", true);
    return;
  }
  const submitButton = userChatForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setStatus(chatStatus, "Подготавливаю сообщение...");
  try {
    const attachments = await attachmentQueue.toPayloads();
    await fetchJson("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, attachments }),
    });
    userChatForm.reset();
    attachmentQueue.clear();
    setStatus(chatStatus, "Сообщение отправлено.");
    await loadMessages();
  } catch (error) {
    setStatus(chatStatus, error instanceof Error ? error.message : "Ошибка отправки сообщения.", true);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

userChatMessages?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const button = target.closest("[data-delete-message]");
  const messageId = button?.getAttribute("data-delete-message");
  if (messageId) deleteMessage(messageId);
});

messageSearch?.addEventListener("input", () => {
  activeMatchIndex = -1;
  applyMessageSearch();
});
document.querySelector("#user-search-prev")?.addEventListener("click", () => stepSearch(-1));
document.querySelector("#user-search-next")?.addEventListener("click", () => stepSearch(1));
latestButton?.addEventListener("click", () => {
  if (userChatMessages) userChatMessages.scrollTo({ top: userChatMessages.scrollHeight, behavior: "smooth" });
});

userLogoutButton?.addEventListener("click", async () => {
  try {
    await fetchJson("/api/auth/logout", { method: "POST" });
  } catch {
    // Redirect still ends the visible session if logout cannot reach the server.
  } finally {
    stopPolling();
    window.location.replace("/");
  }
});

ensureAuthorizedUser();
loadMessages();
startPolling();
