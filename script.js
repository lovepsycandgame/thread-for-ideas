// Thread app implemented in plain JavaScript.
// Data schema:
// signals: { id, text, timestamp, reviewed, keepUntil, discarded }
// threads: { id, signalId, signalText, reason, createdAt, updates: [], status }

(() => {
  const signalInput = document.getElementById('signal-input');
  const signalsContainer = document.getElementById('signals-container');
  const threadsContainer = document.getElementById('threads-container');
  const recallContainer = document.getElementById('recall-container');

  // Load from localStorage or initialize empty arrays
  let signals = JSON.parse(localStorage.getItem('signals') || '[]');
  let threads = JSON.parse(localStorage.getItem('threads') || '[]');

  // Save functions
  function saveSignals() {
    localStorage.setItem('signals', JSON.stringify(signals));
  }
  function saveThreads() {
    localStorage.setItem('threads', JSON.stringify(threads));
  }

  // Utility to create unique IDs
  function uuid() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Utility to compute Jaccard similarity between two strings
  function jaccardSimilarity(a, b) {
    const tokenize = str => {
      return new Set(
        str
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(Boolean),
      );
    };
    const setA = tokenize(a);
    const setB = tokenize(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  // Add a new signal
  function addSignal(text) {
    const now = Date.now();
    const newSignal = {
      id: uuid(),
      text,
      timestamp: now,
      reviewed: false,
      keepUntil: null,
      discarded: false,
    };
    signals.push(newSignal);
    saveSignals();

    checkSimilarSignals(newSignal);
    renderSignals();
    renderRecall(); // update recall after new signal
  }

  // Check for similarity between new signal and existing signals
  function checkSimilarSignals(newSignal) {
    const threshold = 0.35;
    const minIntersection = 2;
    // Clear previous similarity notices but preserve stale thread messages separately
    const children = Array.from(recallContainer.children);
    children.forEach(child => {
      if (child.dataset.type === 'similarity') {
        recallContainer.removeChild(child);
      }
    });
    signals.forEach(sig => {
      if (sig.id !== newSignal.id && !sig.discarded) {
        const wordsA = new Set(
          newSignal.text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(Boolean),
        );
        const wordsB = new Set(
          sig.text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(Boolean),
        );
        const intersectionSize = [...wordsA].filter(x => wordsB.has(x)).length;
        const sim = jaccardSimilarity(newSignal.text, sig.text);
        if (intersectionSize >= minIntersection && sim >= threshold) {
          const div = document.createElement('div');
          div.className = 'recall-notice';
          div.dataset.type = 'similarity';
          div.textContent = `New signal is similar to an existing one: "${sig.text}"`;
          recallContainer.appendChild(div);
        }
      }
    });
  }

  // Render signals needing review
  function renderSignals() {
    signalsContainer.innerHTML = '';
    const now = Date.now();
    // Filter unreviewed signals from last 24h or kept signals (keepUntil > now)
    const pending = signals.filter(sig => {
      if (sig.discarded || sig.reviewed) return false;
      const age = now - sig.timestamp;
      const within24h = age < 24 * 60 * 60 * 1000;
      const kept = sig.keepUntil && now < sig.keepUntil;
      // Auto-discard kept signals if expired
      if (sig.keepUntil && now > sig.keepUntil) {
        sig.discarded = true;
        return false;
      }
      return within24h || kept;
    });
    saveSignals(); // save any modifications
    if (pending.length === 0) {
      signalsContainer.textContent = 'No signals to review right now.';
      return;
    }
    pending.forEach(sig => {
      const card = document.createElement('div');
      card.className = 'signal-card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const date = new Date(sig.timestamp).toLocaleString();
      header.textContent = date;
      const body = document.createElement('div');
      body.textContent = sig.text;
      const actions = document.createElement('div');
      // Discard button
      const discardBtn = document.createElement('button');
      discardBtn.textContent = 'Discard';
      discardBtn.addEventListener('click', () => {
        sig.discarded = true;
        saveSignals();
        renderSignals();
      });
      // Keep for later button
      const keepBtn = document.createElement('button');
      keepBtn.textContent = 'Keep (48h)';
      keepBtn.addEventListener('click', () => {
        sig.keepUntil = Date.now() + 48 * 60 * 60 * 1000;
        saveSignals();
        renderSignals();
      });
      // Create Thread button
      const threadBtn = document.createElement('button');
      threadBtn.textContent = 'Create Thread';
      threadBtn.addEventListener('click', () => {
        const reason = prompt('Why did this feel important at the time?');
        if (reason && reason.trim() !== '') {
          // Create thread
          const newThread = {
            id: uuid(),
            signalId: sig.id,
            signalText: sig.text,
            reason: reason.trim(),
            createdAt: Date.now(),
            updates: [],
            status: 'open',
          };
          threads.push(newThread);
          sig.reviewed = true;
          saveSignals();
          saveThreads();
          renderSignals();
          renderThreads();
        }
      });
      actions.appendChild(discardBtn);
      actions.appendChild(keepBtn);
      actions.appendChild(threadBtn);
      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(actions);
      signalsContainer.appendChild(card);
    });
  }

  // Render threads and updates
  function renderThreads() {
    threadsContainer.innerHTML = '';
    if (threads.length === 0) {
      threadsContainer.textContent = 'No threads yet.';
      return;
    }
    threads.forEach(thread => {
      const card = document.createElement('div');
      card.className = 'thread-card';
      const header = document.createElement('div');
      header.className = 'card-header';
      const createdDate = new Date(thread.createdAt).toLocaleString();
      header.textContent = `Created ${createdDate}`;
      const body = document.createElement('div');
      body.innerHTML = `<strong>Signal:</strong> ${thread.signalText}<br><strong>Reason:</strong> ${thread.reason}`;
      // List of updates
      const updatesList = document.createElement('ul');
      updatesList.className = 'update-list';
      thread.updates.forEach(update => {
        const li = document.createElement('li');
        const d = new Date(update.timestamp).toLocaleString();
        li.textContent = `[${d}] ${update.text}`;
        updatesList.appendChild(li);
      });
      // Update input
      const updateInput = document.createElement('input');
      updateInput.type = 'text';
      updateInput.placeholder = 'Add update and press Enter';
      updateInput.addEventListener('keypress', e => {
        if (e.key === 'Enter' && updateInput.value.trim() !== '') {
          const update = {
            timestamp: Date.now(),
            text: updateInput.value.trim(),
          };
          thread.updates.push(update);
          updateInput.value = '';
          saveThreads();
          renderThreads();
          renderRecall();
        }
      });
      card.appendChild(header);
      card.appendChild(body);
      if (thread.updates.length > 0) {
        card.appendChild(updatesList);
      }
      card.appendChild(updateInput);
      threadsContainer.appendChild(card);
    });
  }

  // Render recall messages for stale threads
  function renderRecall() {
    // Remove stale thread notices
    const children = Array.from(recallContainer.children);
    children.forEach(child => {
      if (child.dataset.type === 'stale') {
        recallContainer.removeChild(child);
      }
    });
    const now = Date.now();
    const staleDays = 7;
    threads.forEach(thread => {
      const lastUpdateTime =
        thread.updates.length > 0
          ? thread.updates[thread.updates.length - 1].timestamp
          : thread.createdAt;
      const ageDays = (now - lastUpdateTime) / (1000 * 60 * 60 * 24);
      if (ageDays > staleDays) {
        const div = document.createElement('div');
        div.className = 'recall-notice';
        div.dataset.type = 'stale';
        div.textContent = `Thread "${thread.signalText}" has no updates for ${Math.floor(
          ageDays,
        )} days. Consider reviewing it.`;
        recallContainer.appendChild(div);
      }
    });
  }

  // Event listeners
  signalInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      const text = signalInput.value.trim();
      if (text !== '') {
        addSignal(text);
        signalInput.value = '';
      }
    }
  });

  // Initial render on page load
  renderSignals();
  renderThreads();
  renderRecall();
})();