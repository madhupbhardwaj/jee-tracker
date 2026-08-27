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
