// Your Google sign-in email. This account can delete any message in Group Chat.
const ADMIN_EMAIL = "geekycoder2010@gmail.com";

const SUBJECTS = [
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'math', name: 'Mathematics' }
];

const STORAGE_PREFIX = 'jee-timer:';

// state[id] = { accumulated: seconds, running: bool, startedAt: epoch_ms|null }
let state = {};

const cardsEl = document.getElementById('cards');
const grandTotalEl = document.getElementById('grandTotal');
const saveNoteEl = document.getElementById('saveNote');

function fmt(totalSeconds){
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds/3600);
  const m = Math.floor((totalSeconds%3600)/60);
  const s = totalSeconds%60;
  return { h, m, s, str: `${h}h ${m}m ${s}s` };
}

function currentSeconds(sub){
  let secs = state[sub.id].accumulated;
  if(state[sub.id].running && state[sub.id].startedAt){
    secs += (Date.now() - state[sub.id].startedAt) / 1000;
  }
  return secs;
}

function render(){
  cardsEl.innerHTML = '';
  let grand = 0;
  SUBJECTS.forEach(sub => {
    const secs = currentSeconds(sub);
    grand += secs;
    const f = fmt(secs);
    const running = state[sub.id].running;

    const card = document.createElement('div');
    card.className = `${sub.id} ${running ? 'running' : ''}`;
    card.innerHTML = `
      <div class="card">
        <div class="card-top">
          <div class="subject">
            <span class="dot"></span>
            <span class="subject-name">${sub.name}</span>
          </div>
          <span class="total">${running ? 'in progress' : 'paused'}</span>
        </div>
        <div class="timer-row">
          <div class="time">${String(f.h).padStart(2,'0')}:${String(f.m).padStart(2,'0')}:${String(f.s).padStart(2,'0')}</div>
          <div class="btns">
            ${running
              ? `<button class="pause" data-action="pause" data-id="${sub.id}">Pause</button>`
              : `<button class="start" data-action="start" data-id="${sub.id}">Start</button>`}
            <button class="reset" data-action="reset" data-id="${sub.id}">Reset</button>
          </div>
        </div>
      </div>
    `;
    cardsEl.appendChild(card);
  });
  const gf = fmt(grand);
  grandTotalEl.textContent = gf.str;
}

let saveTimeout;
function flashSaved(){
  saveNoteEl.classList.add('show');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(()=> saveNoteEl.classList.remove('show'), 900);
}

function persist(id){
  try{
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({
      accumulated: state[id].accumulated,
      running: state[id].running,
      startedAt: state[id].startedAt
    }));
    flashSaved();
    pushToCloud();
  }catch(e){
    console.error('save failed', e);
  }
}

function loadAll(){
  SUBJECTS.forEach(sub => {
    try{
      const raw = localStorage.getItem(STORAGE_PREFIX + sub.id);
      if(raw){
        const parsed = JSON.parse(raw);
        state[sub.id] = {
          accumulated: parsed.accumulated || 0,
          running: !!parsed.running,
          startedAt: parsed.startedAt || null
        };
      } else {
        state[sub.id] = { accumulated: 0, running: false, startedAt: null };
      }
    }catch(e){
      state[sub.id] = { accumulated: 0, running: false, startedAt: null };
    }
  });
  render();
}

function start(id){
  // Only one subject runs at a time, to avoid double-counting study time.
  SUBJECTS.forEach(s => {
    if(s.id !== id && state[s.id].running){
      pause(s.id, false);
    }
  });
  state[id].running = true;
  state[id].startedAt = Date.now();
  persist(id);
}

function pause(id, doPersist = true){
  if(state[id].running){
    state[id].accumulated += (Date.now() - state[id].startedAt) / 1000;
  }
  state[id].running = false;
  state[id].startedAt = null;
  if(doPersist) persist(id);
}

function reset(id){
  state[id] = { accumulated: 0, running: false, startedAt: null };
  persist(id);
}

cardsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const { action, id } = btn.dataset;
  if(action === 'start') start(id);
  else if(action === 'pause') pause(id);
  else if(action === 'reset') {
    if(confirm(`Reset ${id} timer to 0?`)) reset(id);
  }
  render();
});

setInterval(render, 1000);

loadAll();

// ---- Theme toggle ----
const THEME_KEY = 'jee-tracker-theme';
const themeToggleBtn = document.getElementById('themeToggle');
const iconMoon = document.getElementById('iconMoon');
const iconSun = document.getElementById('iconSun');

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  if(theme === 'dark'){
    iconMoon.style.display = 'none';
    iconSun.style.display = 'block';
  } else {
    iconMoon.style.display = 'block';
    iconSun.style.display = 'none';
  }
}

function initTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  if(saved){
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

initTheme();

// ---- To-Do List ----
const TODO_KEY = 'jee-tracker-todos';
const dateStripEl = document.getElementById('dateStrip');
const customDateInput = document.getElementById('customDateInput');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const newTaskInput = document.getElementById('newTaskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const todoDaysEl = document.getElementById('todoDays');

// todos structure: { "YYYY-MM-DD": [ { id, text, done }, ... ], ... }
let todos = {};
let selectedDate = todayISO();
let stripDates = [];

function loadTodos(){
  try{
    const raw = localStorage.getItem(TODO_KEY);
    todos = raw ? JSON.parse(raw) : {};
  }catch(e){
    todos = {};
  }
}

function saveTodos(){
  try{
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
    flashSaved();
    pushToCloud();
  }catch(e){
    console.error('todo save failed', e);
  }
}

function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60000);
  return local.toISOString().slice(0,10);
}

function isoFromParts(y,m,d){
  const mm = String(m).padStart(2,'0');
  const dd = String(d).padStart(2,'0');
  return `${y}-${mm}-${dd}`;
}

function formatDateLabel(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const dateObj = new Date(y, m-1, d);
  const todayIso = todayISO();
  const opts = { weekday:'short', month:'short', day:'numeric' };
  let label = dateObj.toLocaleDateString(undefined, opts);
  if(iso === todayIso) label += ' - Today';
  return label;
}

function formatShortLabel(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const dateObj = new Date(y, m-1, d);
  if(iso === todayISO()) return 'Today';
  return dateObj.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}

function buildDateStrip(){
  // 3 days back, today, 10 days forward
  const base = new Date();
  const dates = [];
  for(let i = -3; i <= 10; i++){
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(isoFromParts(d.getFullYear(), d.getMonth()+1, d.getDate()));
  }
  stripDates = dates;
  renderDateStrip();
}

function renderDateStrip(){
  dateStripEl.innerHTML = '';
  const todayIso = todayISO();
  stripDates.forEach(iso => {
    const [y,m,d] = iso.split('-').map(Number);
    const dateObj = new Date(y, m-1, d);
    const dow = dateObj.toLocaleDateString(undefined, { weekday:'short' });
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'date-chip' + (iso === selectedDate ? ' selected' : '');
    chip.dataset.date = iso;
    chip.innerHTML = `<span class="dow">${iso === todayIso ? 'Today' : dow}</span><span class="dom">${d}</span>`;
    dateStripEl.appendChild(chip);
  });
  // auto-scroll selected chip into view
  const sel = dateStripEl.querySelector('.date-chip.selected');
  if(sel) sel.scrollIntoView({ inline:'center', block:'nearest' });
}

function selectDate(iso){
  selectedDate = iso;
  if(!stripDates.includes(iso)){
    // rebuild strip centered loosely around chosen custom date by just adding it if outside range
    if(!stripDates.includes(iso)){
      stripDates = [...stripDates, iso].sort();
    }
  }
  renderDateStrip();
  selectedDateLabel.textContent = formatShortLabel(iso);
}

function addTask(dateIso, text){
  if(!todos[dateIso]) todos[dateIso] = [];
  todos[dateIso].push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    text: text,
    done: false
  });
  saveTodos();
  renderTodos();
}

function toggleTask(dateIso, id){
  const list = todos[dateIso];
  if(!list) return;
  const item = list.find(t => t.id === id);
  if(item){
    item.done = !item.done;
    saveTodos();
    renderTodos();
  }
}

function deleteTask(dateIso, id){
  const list = todos[dateIso];
  if(!list) return;
  todos[dateIso] = list.filter(t => t.id !== id);
  if(todos[dateIso].length === 0) delete todos[dateIso];
  saveTodos();
  renderTodos();
}

function renderTodos(){
  const dates = Object.keys(todos).sort();
  todoDaysEl.innerHTML = '';

  if(dates.length === 0){
    todoDaysEl.innerHTML = `<div class="todo-empty">No tasks yet. Pick a date above, type a task, and tap +.</div>`;
    return;
  }

  dates.forEach(dateIso => {
    const tasks = todos[dateIso];
    const doneCount = tasks.filter(t => t.done).length;

    const dayEl = document.createElement('div');
    dayEl.className = 'todo-day';
    dayEl.innerHTML = `
      <div class="todo-day-header">
        <span class="todo-day-title">${formatDateLabel(dateIso)}</span>
        <span class="todo-day-count">${doneCount}/${tasks.length} done</span>
      </div>
      <div class="todo-list"></div>
    `;
    const listEl = dayEl.querySelector('.todo-list');

    tasks.forEach(task => {
      const itemEl = document.createElement('div');
      itemEl.className = 'todo-item';
      itemEl.innerHTML = `
        <button class="todo-checkbox ${task.done ? 'checked' : ''}" data-date="${dateIso}" data-id="${task.id}" data-action="toggle"></button>
        <span class="todo-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
        <button class="todo-delete" data-date="${dateIso}" data-id="${task.id}" data-action="delete">&times;</button>
      `;
      listEl.appendChild(itemEl);
    });

    todoDaysEl.appendChild(dayEl);
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function submitNewTask(){
  const text = newTaskInput.value.trim();
  if(!text) return;
  addTask(selectedDate, text);
  newTaskInput.value = '';
  newTaskInput.focus();
}

addTaskBtn.addEventListener('click', submitNewTask);
newTaskInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') submitNewTask();
});

dateStripEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.date-chip');
  if(!chip) return;
  selectDate(chip.dataset.date);
});

customDateInput.addEventListener('change', () => {
  if(customDateInput.value){
    selectDate(customDateInput.value);
  }
});

todoDaysEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const { action, date, id } = btn.dataset;
  if(action === 'toggle') toggleTask(date, id);
  else if(action === 'delete') deleteTask(date, id);
});

buildDateStrip();
selectedDateLabel.textContent = formatShortLabel(selectedDate);
loadTodos();
renderTodos();

// ---- Cloud Sync (Firebase) ----
const cloudSyncBtn = document.getElementById('cloudSyncBtn');
const cloudSyncLabel = document.getElementById('cloudSyncLabel');

let pushTimeout = null;
function pushToCloud(){
  if(!window.CloudSync || !window.CloudSync.currentUser) return;
  clearTimeout(pushTimeout);
  pushTimeout = setTimeout(() => {
    window.CloudSync.saveData({ timers: state, todos: todos });
    window.CloudSync.saveLeaderboardEntry({
      physics: currentSeconds(SUBJECTS[0]),
      chemistry: currentSeconds(SUBJECTS[1]),
      math: currentSeconds(SUBJECTS[2])
    });
  }, 600);
}

function applyCloudData(data){
  let changed = false;
  if(data.timers){
    SUBJECTS.forEach(sub => {
      if(data.timers[sub.id]){
        state[sub.id] = {
          accumulated: data.timers[sub.id].accumulated || 0,
          running: !!data.timers[sub.id].running,
          startedAt: data.timers[sub.id].startedAt || null
        };
        localStorage.setItem(STORAGE_PREFIX + sub.id, JSON.stringify(state[sub.id]));
        changed = true;
      }
    });
  }
  if(data.todos){
    todos = data.todos;
    localStorage.setItem(TODO_KEY, JSON.stringify(todos));
    changed = true;
  }
  if(changed){
    render();
    renderTodos();
    flashSaved();
  }
}

cloudSyncBtn.addEventListener('click', () => {
  if(window.CloudSync && window.CloudSync.currentUser){
    if(confirm('Sign out of cloud sync? Your data will remain saved on this device.')){
      window.CloudSync.signOutUser();
    }
  } else {
    window.CloudSync && window.CloudSync.signIn();
  }
});

window.addEventListener('cloud-auth-changed', (e) => {
  const user = e.detail.user;
  if(user){
    cloudSyncBtn.classList.add('signed-in');
    cloudSyncBtn.title = `Synced as ${user.displayName || user.email} - click to sign out`;
    cloudSyncLabel.textContent = 'Synced';
    // First sign-in: push current local data up in case cloud doc doesn't exist yet.
    pushToCloud();
  } else {
    cloudSyncBtn.classList.remove('signed-in');
    cloudSyncBtn.title = 'Sign in to sync across devices';
    cloudSyncLabel.textContent = 'Sync';
  }
});

window.addEventListener('cloud-data', (e) => applyCloudData(e.detail));

window.addEventListener('cloud-unconfigured', () => {
  cloudSyncBtn.title = 'Cloud sync not set up yet';
});

// ---- Leaderboard ----
const leaderboardListEl = document.getElementById('leaderboardList');
const leaderboardSubEl = document.getElementById('leaderboardSub');

function fmtHM(seconds){
  const h = Math.floor(seconds/3600);
  const m = Math.floor((seconds%3600)/60);
  return `${h}h ${m}m`;
}

function renderLeaderboard(entries){
  entries.sort((a,b) => (b.total||0) - (a.total||0));
  leaderboardListEl.innerHTML = '';
  if(entries.length === 0){
    leaderboardListEl.innerHTML = `<div class="chat-empty">No one's logged study time yet.</div>`;
    return;
  }
  const myUid = window.CloudSync && window.CloudSync.currentUser ? window.CloudSync.currentUser.uid : null;
  entries.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (entry.id === myUid ? ' lb-you' : '');
    const avatar = entry.photoURL
      ? `<img class="lb-avatar" src="${entry.photoURL}" alt="">`
      : `<div class="lb-avatar"></div>`;
    row.innerHTML = `
      <span class="lb-rank">${i+1}</span>
      ${avatar}
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(entry.name || 'Anonymous')}${entry.id === myUid ? ' (you)' : ''}</div>
        <div class="lb-breakdown">P ${fmtHM(entry.physics||0)} &middot; C ${fmtHM(entry.chemistry||0)} &middot; M ${fmtHM(entry.math||0)}</div>
      </div>
      <span class="lb-total">${fmtHM(entry.total||0)}</span>
    `;
    leaderboardListEl.appendChild(row);
  });
}

// ---- Group Chat ----
const chatMessagesEl = document.getElementById('chatMessages');
const chatInputEl = document.getElementById('chatInput');
const chatSendBtnEl = document.getElementById('chatSendBtn');

function chatDateLabel(ts){
  const d = new Date(ts);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate()-1);
  const sameDay = (a,b) => a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  if(sameDay(d, today)) return 'Today';
  if(sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
}

function chatTimeLabel(ts){
  return new Date(ts).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' });
}

function renderMessages(msgs){
  const myUid = window.CloudSync && window.CloudSync.currentUser ? window.CloudSync.currentUser.uid : null;
  const myEmail = window.CloudSync && window.CloudSync.currentUser ? window.CloudSync.currentUser.email : null;
  const isAdmin = myEmail === ADMIN_EMAIL;
  chatMessagesEl.innerHTML = '';
  if(msgs.length === 0){
    chatMessagesEl.innerHTML = `<div class="chat-empty">No messages yet. Say hi!</div>`;
    return;
  }
  let lastDateLabel = null;
  msgs.forEach(m => {
    const ts = m.localTime || Date.now();
    const dateLabel = chatDateLabel(ts);
    if(dateLabel !== lastDateLabel){
      const divider = document.createElement('div');
      divider.className = 'chat-date-divider';
      divider.innerHTML = `<span>${dateLabel}</span>`;
      chatMessagesEl.appendChild(divider);
      lastDateLabel = dateLabel;
    }

    const own = m.uid === myUid;
    const el = document.createElement('div');
    el.className = 'chat-msg' + (own ? ' own' : '');
    const avatar = m.photoURL
      ? `<img class="chat-msg-avatar" src="${m.photoURL}" alt="">`
      : `<div class="chat-msg-avatar"></div>`;
    el.innerHTML = `
      ${avatar}
      <div class="chat-msg-body">
        <div class="chat-msg-name">${own ? 'You' : escapeHtml(m.name || 'Anonymous')}</div>
        <span class="chat-msg-text">${escapeHtml(m.text || '')}</span>
        <div class="chat-msg-time">${chatTimeLabel(ts)}</div>
      </div>
      ${isAdmin ? `<button class="chat-msg-delete" data-id="${m.id}" title="Delete message">&times;</button>` : ''}
    `;
    chatMessagesEl.appendChild(el);
  });
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function sendChatMessage(){
  const text = chatInputEl.value.trim();
  if(!text || !window.CloudSync || !window.CloudSync.currentUser) return;
  window.CloudSync.sendMessage(text);
  chatInputEl.value = '';
}

chatSendBtnEl.addEventListener('click', sendChatMessage);
chatInputEl.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') sendChatMessage();
});

chatMessagesEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chat-msg-delete');
  if(!btn) return;
  if(confirm('Delete this message for everyone?')){
    window.CloudSync && window.CloudSync.deleteMessage(btn.dataset.id);
  }
});

// Enable/disable group features based on sign-in state
window.addEventListener('cloud-auth-changed', (e) => {
  const user = e.detail.user;
  if(user){
    leaderboardSubEl.textContent = "Live study hours across your group.";
    chatSubEl_update(true);
    chatInputEl.disabled = false;
    chatSendBtnEl.disabled = false;
    chatInputEl.placeholder = 'Type a message...';
    window.CloudSync.subscribeLeaderboard(renderLeaderboard);
    window.CloudSync.subscribeMessages(renderMessages);
  } else {
    leaderboardSubEl.textContent = "Sign in to see how your group is studying.";
    chatSubEl_update(false);
    chatInputEl.disabled = true;
    chatSendBtnEl.disabled = true;
    chatInputEl.placeholder = 'Sign in to send a message...';
    leaderboardListEl.innerHTML = '';
    chatMessagesEl.innerHTML = '';
  }
});

function chatSubEl_update(signedIn){
  const el = document.getElementById('chatSub');
  el.textContent = signedIn ? "Chat with everyone in real time." : "Sign in to chat with your group.";
}
