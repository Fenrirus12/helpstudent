(() => {
  const maxFiles = 10;
  const maxFileSize = 5 * 1024 * 1024;
  const maxTotalSize = 25 * 1024 * 1024;

  class ChatAttachmentQueue {
    constructor(input, list, statusNode) {
      this.input = input;
      this.list = list;
      this.statusNode = statusNode;
      this.files = [];
      input?.addEventListener("change", () => this.add(input.files));
      list?.addEventListener("click", (event) => {
        const button = event.target instanceof HTMLElement ? event.target.closest("[data-remove-file]") : null;
        if (!button) return;
        this.files.splice(Number(button.dataset.removeFile), 1);
        this.render();
      });
      this.render();
    }

    add(fileList) {
      const errors = [];
      for (const file of Array.from(fileList || [])) {
        if (file.size > maxFileSize) {
          errors.push(`«${file.name}» больше 5 МБ`);
          continue;
        }
        if (this.files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
          continue;
        }
        if (this.files.length >= maxFiles) {
          errors.push("Можно приложить не больше 10 файлов");
          break;
        }
        const currentSize = this.files.reduce((total, item) => total + item.size, 0);
        if (currentSize + file.size > maxTotalSize) {
          errors.push("Общий размер файлов не должен превышать 25 МБ");
          continue;
        }
        this.files.push(file);
      }
      if (this.input) this.input.value = "";
      this.render();
      if (this.statusNode) {
        this.statusNode.textContent = errors.join(". ");
        this.statusNode.classList.toggle("is-error", errors.length > 0);
      }
    }

    clear() {
      this.files = [];
      if (this.input) this.input.value = "";
      this.render();
    }

    async toPayloads() {
      return Promise.all(this.files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const data = String(reader.result || "");
          resolve({
            name: file.name,
            contentType: file.type || "application/octet-stream",
            contentBase64: data.includes(",") ? data.split(",")[1] : data,
          });
        };
        reader.onerror = () => reject(new Error(`Не удалось прочитать файл «${file.name}».`));
        reader.readAsDataURL(file);
      })));
    }

    render() {
      if (!this.list) return;
      this.list.replaceChildren();
      if (!this.files.length) {
        const empty = document.createElement("span");
        empty.className = "attachment-name";
        empty.textContent = "Файлы не выбраны";
        this.list.appendChild(empty);
        return;
      }
      this.files.forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "chat-pending-file";
        const name = document.createElement("span");
        name.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} КБ`;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chat-file-remove";
        remove.dataset.removeFile = String(index);
        remove.setAttribute("aria-label", `Убрать файл ${file.name}`);
        remove.textContent = "Убрать";
        row.append(name, remove);
        this.list.appendChild(row);
      });
    }
  }

  window.ChatAttachmentQueue = ChatAttachmentQueue;
})();
