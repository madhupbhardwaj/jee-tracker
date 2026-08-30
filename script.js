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
const datePicker = document.getElementById('datePicker');
const addTaskBtn = document.getElementById('addTaskBtn');
const todoDaysEl = document.getElementById('todoDays');

// todos structure: { "YYYY-MM-DD": [ { id, text, done }, ... ], ... }
let todos = {};

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

function formatDateLabel(iso){
  const [y,m,d] = iso.split('-').map(Number);
  const dateObj = new Date(y, m-1, d);
  const today = new Date();
  const todayIso = todayISO();
  const opts = { weekday:'short', month:'short', day:'numeric' };
  let label = dateObj.toLocaleDateString(undefined, opts);
  if(iso === todayIso) label += ' - Today';
  return label;
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
    todoDaysEl.innerHTML = `<div class="todo-empty">No tasks yet. Pick a date above and tap + to add one.</div>`;
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

addTaskBtn.addEventListener('click', () => {
  const dateIso = datePicker.value;
  if(!dateIso){
    alert('Please pick a date first.');
    return;
  }
  const text = prompt('Enter task:');
  if(text && text.trim()){
    addTask(dateIso, text.trim());
  }
});

todoDaysEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const { action, date, id } = btn.dataset;
  if(action === 'toggle') toggleTask(date, id);
  else if(action === 'delete') deleteTask(date, id);
});

datePicker.value = todayISO();
loadTodos();
renderTodos();
