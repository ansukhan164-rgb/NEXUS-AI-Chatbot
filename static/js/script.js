/**
 * NEXUS AI — Production Frontend Interface v3.0
 * Redesigned for premium feel, voice integration, and modularity.
 */

(function () {
  'use strict';

  // ── Configuration ──────────────────────────────────
  const CONFIG = {
    STORAGE_KEY: 'nexus_ai_history',
    MAX_HISTORY: 20,
    VOICE_SENSITIVITY: 0.5,
    VOICE_LANG: 'en-US',
    STREAMING_SPEED: 20, // ms per character
  };

  // ── State Management ──────────────────────────────
  const state = {
    history: JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || [],
    messageCount: parseInt(localStorage.getItem('nexus_msg_count')) || 0,
    isLoading: false,
    isListening: false,
    sessionId: localStorage.getItem('nexus_session_id') || generateSessionId(),
  };

  function saveState() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state.history));
    localStorage.setItem('nexus_msg_count', state.messageCount);
    localStorage.setItem('nexus_session_id', state.sessionId);
  }

  function generateSessionId() {
    return 'NX-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // ── DOM Mapping ────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const dom = {
    messagesList:     $('messagesList'),
    messagesContainer: $('messagesContainer'),
    welcomeScreen:    $('welcomeScreen'),
    typingIndicator:  $('typingIndicator'),
    messageInput:     $('messageInput'),
    sendBtn:          $('sendBtn'),
    voiceBtn:         $('voiceBtn'),
    charCounter:      $('charCounter'),
    clearBtn:         $('clearBtn'),
    sidebar:          $('sidebar'),
    sidebarToggle:    $('sidebarToggle'),
    mobileMenuBtn:    $('mobileMenuBtn'),
    statusDot:        $('statusDot'),
    statusText:       $('statusText'),
    modelName:        $('modelName'),
    sessionIdEl:      $('sessionId'),
    messageCountEl:   $('messageCount'),
    errorToast:       $('errorToast'),
    toastMessage:     $('toastMessage'),
    toastClose:       $('toastClose'),
  };

  // ── Initialization ─────────────────────────────────
  async function init() {
    setupSession();
    await checkHealth();
    setupEventListeners();
    initParticles();
    autoResizeTextarea();
    loadHistory();
  }

  function setupSession() {
    dom.sessionIdEl.textContent = state.sessionId;
  }

  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (data.status === 'online') {
        dom.statusDot.className = 'status-dot online';
        dom.statusText.textContent = data.api_configured ? 'ONLINE' : 'CONFIG ERROR';
        dom.modelName.textContent = data.api_configured ? data.model : 'N/A';
        if (!data.api_configured) {
          showToast('API key not configured. Check .env file.', 8000);
        }
      }
    } catch {
      dom.statusDot.className = 'status-dot error';
      dom.statusText.textContent = 'OFFLINE';
      showToast('Server connection lost. Is Flask running?', 8000);
    }
  }

  // ── Event Listeners ─────────────────────────────────
  function setupEventListeners() {
    dom.sendBtn.addEventListener('click', handleSend);
    dom.voiceBtn.addEventListener('click', toggleVoiceInput);

    dom.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    dom.messageInput.addEventListener('input', () => {
      autoResizeTextarea();
      updateCharCounter();
      dom.sendBtn.disabled = dom.messageInput.value.trim().length === 0 || state.isLoading;
    });

    dom.clearBtn.addEventListener('click', clearConversation);
    dom.sidebarToggle.addEventListener('click', toggleSidebar);
    dom.mobileMenuBtn.addEventListener('click', openMobileSidebar);
    dom.toastClose.addEventListener('click', hideToast);

    document.querySelectorAll('.qp-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setInputValue(btn.dataset.prompt);
        if (window.innerWidth <= 768) closeMobileSidebar();
      });
    });

    document.querySelectorAll('.wg-card').forEach((card) => {
      card.addEventListener('click', () => {
        setInputValue(card.dataset.prompt);
        dom.messageInput.focus();
      });
    });
  }

  function setInputValue(text) {
    dom.messageInput.value = text;
    autoResizeTextarea();
    updateCharCounter();
    dom.sendBtn.disabled = false;
    dom.messageInput.focus();
  }

  // ── Sidebar Logic ───────────────────────────────────
  function toggleSidebar() {
    dom.sidebar.style.width = dom.sidebar.style.width === '0px' ? 'var(--sidebar-w)' : '0px';
  }

  function openMobileSidebar() {
    dom.sidebar.classList.add('open');
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.id = 'sidebarOverlay';
    overlay.addEventListener('click', closeMobileSidebar);
    document.body.appendChild(overlay);
  }

  function closeMobileSidebar() {
    dom.sidebar.classList.remove('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.remove();
  }

  // ── UI Helpers ────────────────────────────────────
  function autoResizeTextarea() {
    const ta = dom.messageInput;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function updateCharCounter() {
    const len = dom.messageInput.value.length;
    dom.charCounter.textContent = `${len.toLocaleString()} / 10,000`;
    dom.charCounter.classList.toggle('warning', len > 9000);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    });
  }

  // ── Conversation Logic ─────────────────────────────
  async function handleSend() {
    const text = dom.messageInput.value.trim();
    if (!text || state.isLoading) return;

    // Transition welcome screen
    if (dom.welcomeScreen.style.display !== 'none' && state.messageCount === 0) {
      dom.welcomeScreen.style.opacity = '0';
      dom.welcomeScreen.style.transform = 'translateY(-20px)';
      dom.welcomeScreen.style.transition = 'all 0.4s ease';
      setTimeout(() => { dom.welcomeScreen.style.display = 'none'; }, 400);
    }

    dom.messageInput.value = '';
    autoResizeTextarea();
    updateCharCounter();
    dom.sendBtn.disabled = true;

    appendMessage('user', text);
    state.history.push({ role: 'user', content: text });
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: state.history.slice(-CONFIG.MAX_HISTORY) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Neural Error: ${response.status}`);

      // Implement Streaming Effect
      const messageElement = appendMessage('nexus', '');
      await streamText(messageElement, data.reply);

      state.history.push({ role: 'nexus', content: data.reply });
      saveState();

    } catch (err) {
      const errMsg = err.message || 'Unknown network failure.';
      appendMessage('nexus', errMsg, true);
      showToast(errMsg, 5000);
    } finally {
      setLoading(false);
    }
  }

  function appendMessage(role, content, isError = false) {
    state.messageCount++;
    dom.messageCountEl.textContent = state.messageCount;

    const msg = document.createElement('div');
    msg.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'N';

    const body = document.createElement('div');
    body.className = 'message-body';

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.innerHTML = `<span class="message-sender">${role === 'user' ? 'YOU' : 'NEXUS'}</span><span class="message-time">${formatTime(new Date())}</span>`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (isError) bubble.classList.add('error-bubble');

    bubble.innerHTML = renderContent(content, isError);

    body.append(meta, bubble);
    msg.append(avatar, body);
    dom.messagesList.appendChild(msg);

    scrollToBottom();
    return bubble;
  }

  async function streamText(element, text) {
    const rendered = renderContent(text);
    let currentText = '';
    const words = rendered.split(' ');

    // Simple approximation of streaming for rendered HTML
    // For a true streaming effect with marked, we would stream raw markdown
    // but to keep it simple and robust, we'll use a fade-in approach for the bubble
    element.style.opacity = '0';
    element.style.transform = 'translateY(10px)';

    // Use marked to render and then fade in
    element.innerHTML = rendered;

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        element.style.transition = 'all 0.5s ease';
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
        setTimeout(resolve, 500);
      });
    });
  }

  function renderContent(text, isError = false) {
    if (isError) return `<p>⚠ ${escapeHtml(text)}</p>`;
    if (typeof marked !== 'undefined') {
      return marked.parse(text);
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function setLoading(loading) {
    state.isLoading = loading;
    dom.typingIndicator.style.display = loading ? 'flex' : 'none';
    dom.sendBtn.disabled = loading;
    if (loading) {
      dom.sendBtn.classList.add('loading');
      scrollToBottom();
    } else {
      dom.sendBtn.classList.remove('loading');
      dom.sendBtn.disabled = dom.messageInput.value.trim().length === 0;
    }
  }

  function loadHistory() {
    if (state.history.length === 0) return;

    state.history.forEach(msg => {
      appendMessage(msg.role === 'user' ? 'user' : 'nexus', msg.content);
    });
    dom.messageCountEl.textContent = state.messageCount;

    if (state.history.length > 0) {
      dom.welcomeScreen.style.display = 'none';
    }
  }

  function clearConversation() {
    state.history = [];
    state.messageCount = 0;
    dom.messageCountEl.textContent = '0';
    dom.messagesList.innerHTML = '';
    saveState();
    dom.welcomeScreen.style.display = 'flex';
    dom.welcomeScreen.style.opacity = '1';
    dom.welcomeScreen.style.transform = 'translateY(0)';
  }

  // ── Voice Assistant ─────────────────────────────────
  async function toggleVoiceInput() {
    if (state.isListening) {
      stopListening();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice recognition not supported in this browser.', 5000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = CONFIG.VOICE_LANG;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      state.isListening = true;
      dom.voiceBtn.classList.add('listening');
      dom.statusText.textContent = 'LISTENING...';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputValue(transcript);
      handleSend();
    };

    recognition.onerror = (event) => {
      showToast(`Voice Error: ${event.error}`, 5000);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };

    recognition.start();
  }

  function stopListening() {
    state.isListening = false;
    dom.voiceBtn.classList.remove('listening');
    dom.statusText.textContent = 'ONLINE';
  }

  // ── Toast Notification ──────────────────────────────
  let toastTimer = null;
  function showToast(message, duration = 4000) {
    dom.toastMessage.textContent = message;
    dom.errorToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, duration);
  }

  function hideToast() {
    dom.errorToast.classList.remove('show');
  }

  // ── Particle System ─────────────────────────────────
  function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = -(Math.random() * 0.4 + 0.1);
        this.life = 0;
        this.maxLife = 200 + Math.random() * 200;
        this.size = Math.random() * 1.5 + 0.3;
        this.color = Math.random() > 0.7 ? [255, 0, 200] : [0, 245, 255];
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life++;
        if (this.life > this.maxLife || this.y < -10) this.reset();
      }
      draw() {
        const progress = this.life / this.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.5;
        const [r, g, b] = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 80; i++) {
      const p = new Particle();
      p.life = Math.random() * p.maxLife;
      particles.push(p);
    }

    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            const alpha = (1 - dist / 100) * 0.06;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      particles.forEach((p) => { p.update(); p.draw(); });
      requestAnimationFrame(loop);
    }
    loop();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
