/**
 * ClinicAI WhatsApp Frontend — app.js
 * Handles chat logic, webhook integration, and UI interactions.
 */

// ============ CONFIG ============
const CONFIG = {
  // Production webhook (workflow is active)
  // To test with editor open, change to: .../webhook-test/clinicai/chat
  webhookUrl: 'https://n8n.srv1181762.hstgr.cloud/webhook/clinicai/chat',
  sessionKey: 'clinicai_session_id',
  historyKey: 'clinicai_history',
  soundKey: 'clinicai_sound',
  maxRetries: 2,
  retryDelay: 2000,
};

// ============ STATE ============
const state = {
  sessionId: null,
  messages: [],
  isTyping: false,
  isSending: false,
  soundEnabled: true,
  unreadCount: 0,
  isScrolledUp: false,
  pendingAction: null,
  originalTitle: document.title,
};

// ============ DOM REFS ============
const dom = {};

function cacheDom() {
  dom.chatMessages = document.getElementById('chatMessages');
  dom.messageInput = document.getElementById('messageInput');
  dom.sendBtn = document.getElementById('sendBtn');
  dom.typingIndicator = document.getElementById('typingIndicator');
  dom.chatStatus = document.getElementById('chatStatus');
  dom.sidebarTime = document.getElementById('sidebarTime');
  dom.sidebarLastMsg = document.getElementById('sidebarLastMsg');
  dom.sidebarBadge = document.getElementById('sidebarBadge');
  dom.sidebar = document.getElementById('sidebar');
  dom.backBtn = document.getElementById('backBtn');
  dom.contactClinic = document.getElementById('contactClinic');
  dom.scrollFab = document.getElementById('scrollFab');
  dom.scrollFabBadge = document.getElementById('scrollFabBadge');
  dom.dialogOverlay = document.getElementById('dialogOverlay');
  dom.dialogText = document.getElementById('dialogText');
  dom.dialogSubtext = document.getElementById('dialogSubtext');
  dom.dialogConfirm = document.getElementById('dialogConfirm');
  dom.dialogCancel = document.getElementById('dialogCancel');
  dom.toastContainer = document.getElementById('toastContainer');

  // Menu buttons
  dom.btnNewChat = document.getElementById('btnNewChat');
  dom.btnNewChatHeader = document.getElementById('btnNewChatHeader');
  dom.btnSidebarMenu = document.getElementById('btnSidebarMenu');
  dom.btnChatMenu = document.getElementById('btnChatMenu');
  dom.sidebarDropdown = document.getElementById('sidebarDropdown');
  dom.chatDropdown = document.getElementById('chatDropdown');

  // Menu items
  dom.menuNewChat = document.getElementById('menuNewChat');
  dom.menuClearChat = document.getElementById('menuClearChat');
  dom.menuToggleSound = document.getElementById('menuToggleSound');
  dom.menuNewChat2 = document.getElementById('menuNewChat2');
  dom.menuClearChat2 = document.getElementById('menuClearChat2');
  dom.menuExport = document.getElementById('menuExport');
  dom.soundLabel = document.getElementById('soundLabel');
}

// ============ INIT ============
function init() {
  cacheDom();
  state.sessionId = loadOrCreateSession();
  state.soundEnabled = localStorage.getItem(CONFIG.soundKey) !== 'false';
  updateSoundLabel();
  loadHistory();
  setupEventListeners();
  renderSavedMessages();
  handleResize();

  // If no messages yet, show initial bot greeting
  if (state.messages.length === 0) {
    setTimeout(() => {
      addBotMessage('Oi! Aqui é a Alice, da Clínica Geral.');
      setTimeout(() => {
        addBotMessage('Precisa de alguma coisa?');
      }, 1000);
    }, 800);
  }
}

// ============ RESPONSIVE HELPERS ============
function handleResize() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    dom.sidebar.classList.add('sidebar-closed');
  } else {
    dom.sidebar.classList.remove('sidebar-closed');
  }
}

// ============ SESSION ============
function loadOrCreateSession() {
  let id = localStorage.getItem(CONFIG.sessionKey);
  if (!id) {
    id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(CONFIG.sessionKey, id);
  }
  return id;
}

// ============ HISTORY ============
function loadHistory() {
  try {
    const saved = localStorage.getItem(CONFIG.historyKey);
    if (saved) state.messages = JSON.parse(saved);
  } catch { state.messages = []; }
}

function saveHistory() {
  try {
    // Keep last 100 messages to avoid localStorage bloat
    const toSave = state.messages.slice(-100);
    localStorage.setItem(CONFIG.historyKey, JSON.stringify(toSave));
  } catch { /* ignore quota errors */ }
}

// ============ EVENTS ============
function setupEventListeners() {
  // Send on button click
  dom.sendBtn.addEventListener('click', handleSend);

  // Send on Enter (Shift+Enter for new line)
  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  dom.messageInput.addEventListener('input', () => {
    dom.messageInput.style.height = 'auto';
    dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 120) + 'px';
    // Toggle send button state
    dom.sendBtn.classList.toggle('active', dom.messageInput.value.trim().length > 0);
  });

  // Mobile: sidebar toggle
  dom.backBtn.addEventListener('click', () => {
    dom.sidebar.classList.remove('sidebar-closed');
  });

  dom.contactClinic.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      dom.sidebar.classList.add('sidebar-closed');
    }
    dom.sidebarBadge.style.display = 'none';
  });

  // Scroll detection for FAB
  dom.chatMessages.addEventListener('scroll', handleScroll);

  // Scroll FAB click
  dom.scrollFab.addEventListener('click', () => {
    scrollToBottom();
    state.unreadCount = 0;
    dom.scrollFabBadge.classList.remove('show');
    dom.scrollFabBadge.textContent = '';
  });

  // New chat buttons (direct)
  dom.btnNewChat.addEventListener('click', () => showNewChatDialog());
  dom.btnNewChatHeader.addEventListener('click', () => showNewChatDialog());

  // Dropdown menus
  dom.btnSidebarMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dom.sidebarDropdown, dom.btnSidebarMenu);
  });

  dom.btnChatMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(dom.chatDropdown, dom.btnChatMenu);
  });

  // Menu items — sidebar
  dom.menuNewChat.addEventListener('click', () => {
    closeAllDropdowns();
    showNewChatDialog();
  });

  dom.menuClearChat.addEventListener('click', () => {
    closeAllDropdowns();
    showClearChatDialog();
  });

  dom.menuToggleSound.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    localStorage.setItem(CONFIG.soundKey, state.soundEnabled);
    updateSoundLabel();
    showToast(state.soundEnabled ? 'Som de notificação ativado' : 'Som de notificação desativado');
  });

  // Menu items — chat header
  dom.menuNewChat2.addEventListener('click', () => {
    closeAllDropdowns();
    showNewChatDialog();
  });

  dom.menuClearChat2.addEventListener('click', () => {
    closeAllDropdowns();
    showClearChatDialog();
  });

  dom.menuExport.addEventListener('click', () => {
    closeAllDropdowns();
    exportConversation();
  });

  // Dialog
  dom.dialogCancel.addEventListener('click', closeDialog);
  dom.dialogOverlay.addEventListener('click', (e) => {
    if (e.target === dom.dialogOverlay) closeDialog();
  });
  dom.dialogConfirm.addEventListener('click', () => {
    if (state.pendingAction) state.pendingAction();
    closeDialog();
  });

  // Close dropdowns on outside click
  document.addEventListener('click', closeAllDropdowns);

  // Tab visibility — clear unread on focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      document.title = state.originalTitle;
    }
  });

  // Escape key closes dialogs
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDialog();
      closeAllDropdowns();
    }
  });

  // Window resize — adapt sidebar visibility
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 150);
  });
}

// ============ SEND MESSAGE ============
async function handleSend() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isSending) return;

  state.isSending = true;
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  dom.sendBtn.classList.remove('active');

  // Add user message to UI
  addUserMessage(text);

  // Show typing indicator
  showTyping();

  try {
    const response = await sendToWebhook(text);
    hideTyping();
    
    // Separar a resposta pelo delimitador || para simular mensagens múltiplas
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);
    const messages = responseText.split('||');
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i].trim();
      if (msg) {
        if (i > 0) {
          // Mostrar "digitando..." antes da próxima mensagem
          showTyping();
          await delay(Math.min(msg.length * 30 + 500, 2000));
          hideTyping();
        }
        addBotMessage(msg);
      }
    }
  } catch (error) {
    hideTyping();
    addBotMessage('Desculpe, ocorreu um erro na comunicação. Tente novamente em alguns instantes.');
    console.error('[ClinicAI] Webhook error:', error);
  }

  state.isSending = false;
  dom.messageInput.focus();
}

// ============ WEBHOOK ============
async function sendToWebhook(message, attempt = 0) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        session_id: state.sessionId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    // Handle different n8n response formats
    if (Array.isArray(data)) {
      return data[0]?.message || data[0]?.output || data[0]?.text || JSON.stringify(data[0]);
    }
    return data.message || data.output || data.text || data.response || JSON.stringify(data);

  } catch (err) {
    if (attempt < CONFIG.maxRetries) {
      await delay(CONFIG.retryDelay);
      return sendToWebhook(message, attempt + 1);
    }
    throw err;
  }
}

// ============ MESSAGE RENDERING ============
function addUserMessage(text) {
  const msg = { role: 'user', content: text, time: now() };
  state.messages.push(msg);
  saveHistory();
  renderMessage(msg);
  updateSidebar(text);
  scrollToBottom();
}

function addBotMessage(text) {
  const msg = { role: 'assistant', content: text, time: now() };
  state.messages.push(msg);
  saveHistory();
  renderMessage(msg);
  updateSidebar(text);

  // Sound notification
  if (state.soundEnabled) playNotificationSound();

  // If scrolled up, show unread count
  if (state.isScrolledUp) {
    state.unreadCount++;
    dom.scrollFabBadge.textContent = state.unreadCount;
    dom.scrollFabBadge.classList.add('show');
  } else {
    scrollToBottom();
  }

  // Tab title notification
  if (document.hidden) {
    document.title = `(${state.messages.filter(m => m.role === 'assistant').length}) ${state.originalTitle}`;
  }

  // Update sidebar badge
  dom.sidebarBadge.textContent = '1';
  dom.sidebarBadge.style.display = 'flex';
}

function renderMessage(msg) {
  const isUser = msg.role === 'user';
  const wrapper = document.createElement('div');
  wrapper.className = `message ${isUser ? 'outgoing' : 'incoming'}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const textEl = document.createElement('span');
  textEl.className = 'message-text';
  textEl.innerHTML = linkify(msg.content);

  const meta = document.createElement('span');
  meta.className = 'message-meta';

  const timeEl = document.createElement('span');
  timeEl.className = 'message-time';
  timeEl.textContent = msg.time;

  meta.appendChild(timeEl);

  if (isUser) {
    const status = document.createElement('span');
    status.className = 'message-status read';
    status.innerHTML = '<svg viewBox="0 0 16 11"><path d="M11.07.66L5.4 7.18 3.55 5.06l-.98.84 2.87 3.33 6.64-7.58z"/><path d="M7.6.66L1.93 7.18.08 5.06l-.98.84 2.87 3.33L8.58 1.5z" opacity=".4"/></svg>';
    meta.appendChild(status);
  }

  bubble.appendChild(textEl);
  bubble.appendChild(meta);
  wrapper.appendChild(bubble);

  // Click to copy message
  bubble.addEventListener('click', () => copyMessage(bubble, msg.content));

  // Insert before typing indicator
  dom.chatMessages.insertBefore(wrapper, dom.typingIndicator);
}

function renderSavedMessages() {
  state.messages.forEach(msg => renderMessage(msg));
  scrollToBottom(false);
}

// ============ TYPING INDICATOR ============
function showTyping() {
  state.isTyping = true;
  dom.typingIndicator.classList.add('active');
  dom.chatStatus.textContent = 'digitando...';
  scrollToBottom();
}

function hideTyping() {
  state.isTyping = false;
  dom.typingIndicator.classList.remove('active');
  dom.chatStatus.textContent = 'online';
}

// ============ SIDEBAR ============
function updateSidebar(text) {
  dom.sidebarLastMsg.textContent = text.length > 40 ? text.slice(0, 40) + '...' : text;
  dom.sidebarTime.textContent = now();
}

// ============ SCROLL MANAGEMENT ============
function handleScroll() {
  const el = dom.chatMessages;
  const threshold = 150;
  const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  state.isScrolledUp = distFromBottom > threshold;

  if (state.isScrolledUp) {
    dom.scrollFab.classList.add('show');
  } else {
    dom.scrollFab.classList.remove('show');
    state.unreadCount = 0;
    dom.scrollFabBadge.classList.remove('show');
    dom.scrollFabBadge.textContent = '';
  }
}

// ============ DROPDOWN MENUS ============
function toggleDropdown(menu, triggerBtn) {
  const wasOpen = menu.classList.contains('show');
  closeAllDropdowns();
  if (!wasOpen) {
    // Position the fixed dropdown relative to the trigger button
    const rect = triggerBtn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 4) + 'px';
    
    menu.style.left = 'auto';
    menu.style.right = 'auto';
    
    // Position based on which half of the screen the button is on
    if (rect.right > window.innerWidth / 2) {
      // Right side: align right edge, but keep at least 16px from the screen edge
      menu.style.right = Math.max(16, window.innerWidth - rect.right) + 'px';
    } else {
      // Left side: align left edge, but keep at least 16px from the screen edge
      menu.style.left = Math.max(16, rect.left) + 'px';
    }

    menu.classList.add('show');
  }
}

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
}

// ============ DIALOGS ============
function showDialog(text, subtext, onConfirm) {
  dom.dialogText.textContent = text;
  dom.dialogSubtext.textContent = subtext;
  state.pendingAction = onConfirm;
  dom.dialogOverlay.classList.add('show');
}

function closeDialog() {
  dom.dialogOverlay.classList.remove('show');
  state.pendingAction = null;
}

function showNewChatDialog() {
  showDialog(
    'Iniciar nova conversa?',
    'Uma nova sessão será criada. O histórico anterior será apagado do navegador.',
    startNewConversation
  );
}

function showClearChatDialog() {
  showDialog(
    'Limpar conversa?',
    'Todas as mensagens serão removidas da tela. A sessão continuará ativa.',
    clearChat
  );
}

// ============ ACTIONS ============
function startNewConversation() {
  // Clear state
  state.messages = [];
  state.unreadCount = 0;

  // Clear localStorage
  localStorage.removeItem(CONFIG.sessionKey);
  localStorage.removeItem(CONFIG.historyKey);

  // New session
  state.sessionId = loadOrCreateSession();

  // Clear chat DOM
  clearChatDom();

  // Reset sidebar
  dom.sidebarLastMsg.textContent = 'Toque para iniciar conversa';
  dom.sidebarTime.textContent = 'agora';
  dom.sidebarBadge.style.display = 'none';

  // Reset tab title
  document.title = state.originalTitle;

  // Greeting after reset
  setTimeout(() => {
    addBotMessage('Oi! Aqui é a Alice, da Clínica Geral.');
    setTimeout(() => {
      addBotMessage('Precisa de alguma coisa?');
    }, 1000);
  }, 600);

  showToast('Nova conversa iniciada');
}

function clearChat() {
  state.messages = [];
  localStorage.removeItem(CONFIG.historyKey);
  clearChatDom();
  dom.sidebarLastMsg.textContent = 'Conversa limpa';
  dom.sidebarBadge.style.display = 'none';
  showToast('Conversa limpa');
}

function clearChatDom() {
  // Remove all message elements, keep system message, date divider & typing
  const messages = dom.chatMessages.querySelectorAll('.message');
  messages.forEach(m => m.remove());
}

function exportConversation() {
  if (state.messages.length === 0) {
    showToast('Nenhuma mensagem para exportar');
    return;
  }

  let text = `Conversa — Clínica Geral\n`;
  text += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
  text += `Sessão: ${state.sessionId}\n`;
  text += '—'.repeat(40) + '\n\n';

  state.messages.forEach(msg => {
    const sender = msg.role === 'user' ? 'Você' : 'Ana (Bot)';
    text += `[${msg.time}] ${sender}:\n${msg.content}\n\n`;
  });

  // Download as txt
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversa-clinica-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Conversa exportada com sucesso');
}

function copyMessage(bubble, text) {
  navigator.clipboard.writeText(text).then(() => {
    bubble.classList.add('copied');
    setTimeout(() => bubble.classList.remove('copied'), 1500);
  }).catch(() => {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    bubble.classList.add('copied');
    setTimeout(() => bubble.classList.remove('copied'), 1500);
  });
}

// ============ TOAST ============
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>${message}`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove());
  }, 2500);
}

// ============ SOUND ============
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* Audio not supported */ }
}

function updateSoundLabel() {
  if (dom.soundLabel) {
    dom.soundLabel.textContent = state.soundEnabled ? 'Som: Ligado' : 'Som: Desligado';
  }
}

// ============ UTILS ============
function now() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function linkify(text) {
  // Escape HTML first to prevent XSS, then convert URLs to clickable links
  const safe = escapeHtml(text);
  const urlPattern = /(https?:\/\/[^\s<]+)/g;
  return safe.replace(urlPattern, (url) => {
    // Truncate display text for long URLs
    const display = url.length > 45 ? url.slice(0, 42) + '...' : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="message-link">${display}</a>`;
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function scrollToBottom(smooth = true) {
  requestAnimationFrame(() => {
    dom.chatMessages.scrollTo({
      top: dom.chatMessages.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  });
}

// ============ START ============
document.addEventListener('DOMContentLoaded', init);
