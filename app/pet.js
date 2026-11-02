// Petter's creature: a round jelly critter with ears, drawn on a canvas. It wanders, reacts to the
// app you're in, dances when Listener plays, naps when you're away, and grows with XP.
const P = window.petter;
const cv = document.getElementById('c'), g = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;
function size() {
  dpr = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', size);
size();

const COLORS = ['#8fb0ff', '#ff8fbf', '#7fe3b5', '#ffbf6b', '#c39bff', '#6fd6ff', '#ff9b80'];
const GROUND = () => H - 12;
const R = 30; // body radius

// ---------- the pet (saved between runs) ----------
const pet = { name: '', color: COLORS[0], xp: 0, level: 1, born: Date.now(), ...(await P.load()) };
const levelFor = (xp) => 1 + Math.floor(Math.sqrt(xp / 40));
const TRICKS = [[1, 'hop'], [2, 'spin'], [3, 'backflip'], [4, 'moonwalk'], [5, 'tornado']];
const known = () => TRICKS.filter(([l]) => pet.level >= l).map(([, t]) => t);
function gainXp(n) {
  pet.xp += n;
  const lvl = levelFor(pet.xp);
  if (lvl > pet.level) {
    pet.level = lvl;
    const unlocked = TRICKS.find(([l]) => l === lvl);
    say(unlocked ? `Level ${lvl}! I learned a ${unlocked[1]}!` : `Level ${lvl}!`, 4000);
    burst('✦', 14, '#ffd36b');
    setMode('trick', 1.4, unlocked?.[1] || 'spin');
  }
}
setInterval(() => P.save(pet), 30000);

// ---------- body state ----------
const b = { x: W * 0.7, y: 0, vx: 0, vy: 0, face: -1, target: null, squash: 0, t: 0, blink: 0, look: { x: 0, y: 0 } };
let mode = 'wander', modeUntil = 0, modeArg = null, mood = 'idle';
let appName = '', music = false, song = '', night = false, away = false;
const fx = []; // floating particles: notes, hearts, sparkles, zzz
let bubble = null; // { text, until }
let ball = null;

function setMode(m, secs = 0, arg = null) { mode = m; modeUntil = secs ? performance.now() + secs * 1000 : 0; modeArg = arg; }
function say(text, ms = 3000) { bubble = { text, until: performance.now() + ms }; }
function burst(ch, n, color) {
  for (let i = 0; i < n; i++) fx.push({ ch, x: b.x + (Math.random() - 0.5) * 40, y: GROUND() - b.y - R * 1.4, vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 90, life: 1.6, color });
}
const floaty = (ch, color) => fx.push({ ch, x: b.x + b.face * 18 + (Math.random() - 0.5) * 20, y: GROUND() - b.y - R * 1.8, vx: (Math.random() - 0.5) * 20, vy: -40, life: 2, color });

// what it does in each app (by program name)
const APPS = [
  [/^(gamer|steam|epicgameslauncher|robloxplayerbeta|minecraft|javaw|valorant|fortniteclient.*|riotclientservices|leagueclient|overwatch|cs2|r5apex)$/i, 'hype', ['gg incoming!', "let's goooo", 'I believe in you!', 'one more game?']],
  [/^(code|devenv|windowsterminal|powershell|cmd|idea64|pycharm64|cursor|sublime_text|notepad\+\+)$/i, 'nerd', ['*types very fast*', 'is that a bug?', 'beep boop', 'ship it!']],
  [/^(weber|chrome|msedge|firefox|brave|opera)$/i, 'browse', ['ooh, what are we looking at?', 'click the shiny thing', 'so many tabs…']],
  [/^(socialer|discord|whatsapp|telegram|phoneexperiencehost)$/i, 'chat', ['say hi from me!', 'ooh, gossip?', 'who is it?']],
  [/^(beater)$/i, 'dance', ['MAKE IT BOUNCE', 'that kick slaps', 'producer mode']],
  [/^(streamer)$/i, 'watch', ['popcorn time', 'no spoilers!', 'one more episode…']],
  [/^(listener)$/i, 'listen', ['play a banger!', 'what are we listening to?']],
  [/^(j\.a\.r\.v\.i\.s\. assistant|electron)$/i, 'salute', ['hi Jarvis!', 'reporting for duty']],
];
function reactToApp() {
  const hit = APPS.find(([re]) => re.test(appName));
  if (!hit) { mood = 'idle'; return; }
  mood = hit[1];
  if (Math.random() < 0.7) say(hit[2][Math.floor(Math.random() * hit[2].length)]);
}

P.onEvent((ev) => {
  if (ev.type === 'app') { appName = ev.name; if (!away) reactToApp(); }
  else if (ev.type === 'music') {
    music = ev.playing; song = ev.song;
    if (music && !away) { say(`♪ ${song}`.slice(0, 48), 4000); gainXp(1); }
  }
  else if (ev.type === 'feed') feed();
  else if (ev.type === 'ball') throwBall();
  else if (ev.type === 'trick') trick();
  else if (ev.type === 'rename') rename();
  else if (ev.type === 'color') { pet.color = COLORS[(COLORS.indexOf(pet.color) + 1) % COLORS.length]; burst('✦', 8, pet.color); P.save(pet); }
  else if (ev.type === 'hello') { wake(); say(pick(['hi!', `${pet.name || 'me'} here!`, 'you called?'])); setMode('trick', 1, 'hop'); }
  else if (ev.type === 'away') { away = true; setMode('sleep'); }
});
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function feed() {
  wake();
  setMode('eat', 2.4);
  say(pick(['nom nom', 'yummy!', 'snack time!', 'more please']));
  gainXp(3);
}
function trick() {
  wake();
  const t = pick(known());
  setMode('trick', t === 'moonwalk' ? 2.4 : 1.2, t);
  gainXp(2);
}
function throwBall() {
  wake();
  ball = { x: b.x < W / 2 ? W - 40 : 40, y: 120, vx: b.x < W / 2 ? -320 : 320, vy: -200, held: false };
  setMode('fetch');
  say('BALL!');
}
function wake() {
  if (mode === 'sleep') { say('*yawn* …oh hi'); }
  away = false;
  if (mode === 'sleep') setMode('wander');
}
function rename() {
  const f = document.getElementById('name'), input = f.querySelector('input');
  P.hit(true);
  P.typing(true);
  f.style.display = 'block';
  f.style.left = Math.max(8, Math.min(W - 190, b.x - 85)) + 'px';
  f.style.top = Math.max(8, GROUND() - b.y - R * 2 - 70) + 'px';
  input.value = pet.name;
  setTimeout(() => input.focus(), 50);
  const done = () => { f.style.display = 'none'; P.typing(false); P.hit(false); };
  f.onsubmit = (e) => {
    e.preventDefault();
    if (input.value.trim()) { pet.name = input.value.trim(); P.save(pet); say(`I'm ${pet.name} now!`); burst('♥', 8, '#ff7aa8'); }
    done();
  };
  input.onblur = done;
  input.onkeydown = (e) => e.key === 'Escape' && done();
}

// ---------- mouse: pet it, drag it, throw it, right-click for the menu ----------
let over = false, drag = null, mouse = { x: -999, y: -999 };
const onPet = (x, y) => Math.hypot(x - b.x, y - (GROUND() - b.y - R)) < R + 12;
addEventListener('mousemove', (e) => {
  mouse = { x: e.clientX, y: e.clientY };
  const now = drag || onPet(e.clientX, e.clientY) || document.getElementById('name').style.display === 'block';
  if (now !== over) { over = now; P.hit(over); }
  if (drag) {
    drag.moved ||= Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6;
    const nx = e.clientX, ny = Math.max(0, GROUND() - e.clientY - R);
    drag.vx = (nx - b.x) * 30; drag.vy = (ny - b.y) * 30;
    b.x = nx; b.y = ny;
  }
});
addEventListener('mousedown', (e) => {
  if (e.button === 2 || !onPet(e.clientX, e.clientY)) return;
  drag = { sx: e.clientX, sy: e.clientY, moved: false, vx: 0, vy: 0 };
  wake();
});
addEventListener('mouseup', () => {
  if (!drag) return;
  if (!drag.moved) { // a click is a pet
    setMode('petted', 1.6);
    burst('♥', 5, '#ff7aa8');
    say(pick(['hehe', '♥', 'more pets!', 'purr…']), 1600);
    gainXp(5);
  } else {
    b.vx = Math.max(-900, Math.min(900, drag.vx));
    b.vy = Math.max(-200, Math.min(900, drag.vy));
    setMode('fall');
    if (b.y > 60) say(pick(['wheee!', 'AAAA', 'again!']), 1500);
  }
  drag = null;
});
addEventListener('contextmenu', (e) => { e.preventDefault(); if (onPet(e.clientX, e.clientY)) P.menu(); });

// ---------- behaviour ----------
let nextIdleCheck = 0;
async function checkIdle(now) {
  if (now < nextIdleCheck) return;
  nextIdleCheck = now + 10000;
  const idle = await P.idle();
  const h = new Date().getHours();
  night = h >= 1 && h < 5;
  if (idle > 300 && mode !== 'sleep' && !drag) { setMode('sleep'); }
  else if (idle < 5 && mode === 'sleep' && !away) { setMode('wander'); say(pick(['*yawn*', 'oh! you\'re back', 'I wasn\'t sleeping…'])); }
  else if (night && mode === 'wander' && Math.random() < 0.15) say(pick(["it's sooo late…", 'bedtime?', '*yawn*']));
  if (idle < 60 && mode !== 'sleep') gainXp(1 / 6); // about 1 XP a minute together
}

function update(dt, now) {
  b.t += dt;
  if (modeUntil && now > modeUntil) setMode('wander');
  if (drag) { b.squash = 0.15; return; }
  const ground = b.y <= 0;
  if (!ground || b.vy > 0) { b.vy -= 1500 * dt; b.y += b.vy * dt; b.x += b.vx * dt; }
  if (b.y <= 0 && b.vy <= 0) {
    if (b.vy < -350) { b.squash = 0.35; b.vy = -b.vy * 0.35; b.vx *= 0.6; } else { b.y = 0; b.vy = 0; if (mode === 'fall') setMode('wander'); }
  }
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.5; }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.5; }
  b.squash *= 0.86;

  const active = music ? 'dance' : mood;
  if (mode === 'wander' && b.y === 0) {
    if (active !== 'idle' && active !== 'browse' && active !== 'chat') { b.vx = 0; }
    else {
      if (!b.target || Math.abs(b.target - b.x) < 4) {
        if (Math.random() < dt * 0.35) b.target = Math.max(R * 2, Math.min(W - R * 2, b.x + (Math.random() - 0.5) * 600));
        else b.vx *= 0.8;
      }
      if (b.target != null && Math.abs(b.target - b.x) >= 4) { b.face = Math.sign(b.target - b.x); b.vx = b.face * (night ? 30 : 55); b.x += b.vx * dt; }
      else b.vx = 0;
    }
    if (active === 'dance' && Math.random() < dt * 0.9) floaty(pick(['♪', '♫']), '#c39bff');
    if (active === 'hype' && Math.random() < dt * 1.5) { b.vy = 260; b.y = 0.1; }
    if (active === 'chat' && Math.random() < dt * 0.4) floaty('♥', '#ff7aa8');
  }
  if (mode === 'sleep' && Math.random() < dt * 0.7) floaty('z', '#9fb6ff');
  if (mode === 'eat' && Math.random() < dt * 8) fx.push({ ch: '·', x: b.x + b.face * 14, y: GROUND() - R * 0.8, vx: (Math.random() - 0.5) * 60, vy: -30, life: 0.6, color: '#d9a066' });
  if (mode === 'trick' && modeArg === 'moonwalk') { b.x -= b.face * 70 * dt; }
  if (mode === 'trick' && (modeArg === 'hop' || modeArg === 'backflip' || modeArg === 'tornado') && b.y === 0 && b.vy === 0 && now < modeUntil - 300) b.vy = modeArg === 'hop' ? 380 : 520, b.y = 0.1;
  if (mode === 'fetch' && ball) {
    if (!ball.held) {
      b.face = Math.sign(ball.x - b.x) || b.face;
      if (b.y === 0) b.x += b.face * 220 * dt;
      if (Math.abs(ball.x - b.x) < R && ball.y < 50) { ball.held = true; say('got it!'); gainXp(4); b.target = W / 2; }
    } else {
      b.face = Math.sign(W / 2 - b.x) || b.face;
      b.x += b.face * 120 * dt;
      if (Math.abs(W / 2 - b.x) < 10) { ball = null; setMode('trick', 1, 'hop'); say(pick(['again!', 'throw it again!', 'fetched!'])); }
    }
  }
  if (ball && !ball.held) {
    ball.vy -= 1500 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (ball.y <= 0) { ball.y = 0; ball.vy = Math.abs(ball.vy) > 120 ? -ball.vy * 0.55 : 0; ball.vx *= 0.92; }
    if (ball.x < 10 || ball.x > W - 10) ball.vx *= -1;
  }
  // blink, and look at the mouse
  if (b.blink > 0) b.blink -= dt; else if (Math.random() < dt * 0.4) b.blink = 0.14;
  const dx = mouse.x - b.x, dy = mouse.y - (GROUND() - b.y - R);
  const d = Math.max(1, Math.hypot(dx, dy));
  b.look.x += ((dx / d) * Math.min(1, d / 200) - b.look.x) * 0.15;
  b.look.y += ((dy / d) * Math.min(1, d / 200) - b.look.y) * 0.15;
  for (const p of fx) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 20 * dt; p.life -= dt; }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
}

// ---------- drawing ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
function draw(now) {
  g.clearRect(0, 0, W, H);
  const active = music && mode === 'wander' ? 'dance' : mode === 'wander' ? mood : mode;
  const gy = GROUND();
  let bob = Math.sin(b.t * 3) * 1.5, tilt = 0, sx = 1 + b.squash * 0.6, sy = 1 - b.squash;
  if (active === 'dance') { bob = Math.abs(Math.sin(b.t * 6)) * -10; tilt = Math.sin(b.t * 6) * 0.18; sy *= 1 + Math.sin(b.t * 12) * 0.05; }
  if (active === 'nerd') bob = Math.sin(b.t * 14) * 0.8;
  if (active === 'sleep') { bob = Math.sin(b.t * 1.4) * 2; sy *= 0.9; sx *= 1.06; }
  if (active === 'petted') { tilt = Math.sin(b.t * 10) * 0.08; sx *= 1.05; }
  if (active === 'salute') tilt = -0.05;
  if (mode === 'trick') {
    const p = 1 - Math.max(0, (modeUntil - now) / (modeArg === 'moonwalk' ? 2400 : 1200));
    if (modeArg === 'spin') sx *= Math.cos(p * Math.PI * 4);
    if (modeArg === 'backflip') tilt = -p * Math.PI * 2;
    if (modeArg === 'tornado') { sx *= Math.cos(p * Math.PI * 10); bob -= Math.sin(p * Math.PI) * 20; }
  }
  // shadow
  const sh = Math.max(0.3, 1 - b.y / 160);
  g.fillStyle = `rgb(0 0 0 / ${0.22 * sh})`;
  g.beginPath(); g.ellipse(b.x, gy + 2, R * 0.9 * sh, 5 * sh, 0, 0, Math.PI * 2); g.fill();
  // the ball
  if (ball) {
    const bx = ball.held ? b.x + b.face * 22 : ball.x, by = ball.held ? gy - b.y - R * 0.7 : gy - ball.y - 9;
    g.fillStyle = '#ff6b6b'; g.beginPath(); g.arc(bx, by, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(bx, by, 9, 0.3, 2.2); g.stroke();
  }

  g.save();
  g.translate(b.x, gy - b.y + bob);
  g.rotate(tilt);
  g.scale(sx * (b.face < 0 ? 1 : -1) * (mode === 'trick' && modeArg === 'moonwalk' ? -1 : 1), sy);
  const c = pet.color;
  // feet
  const step = b.vx && b.y === 0 ? Math.sin(b.t * 14) * 4 : 0;
  g.fillStyle = shade(c, -40);
  g.beginPath(); g.ellipse(-12 + step, -3, 9, 5, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(12 - step, -3, 9, 5, 0, 0, Math.PI * 2); g.fill();
  // ears
  g.fillStyle = shade(c, -15);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 10, -R * 1.7); g.quadraticCurveTo(s * 26, -R * 2.6 + (active === 'sleep' ? 14 : 0), s * 28, -R * 1.45); g.closePath(); g.fill();
  }
  // body
  const grad = g.createRadialGradient(-8, -R * 1.35, 4, 0, -R, R * 1.3);
  grad.addColorStop(0, shade(c, 50)); grad.addColorStop(1, c);
  g.fillStyle = grad;
  g.beginPath(); g.ellipse(0, -R, R * 1.05, R, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgb(255 255 255 / .35)';
  g.beginPath(); g.ellipse(-11, -R * 1.5, 8, 4.5, -0.5, 0, Math.PI * 2); g.fill();
  // face (eyes look toward the mouse; mirrored with the body, so flip x back)
  const lx = b.look.x * 3 * (b.face < 0 ? 1 : -1), ly = b.look.y * 2.5;
  const closed = b.blink > 0 || active === 'sleep';
  const happy = active === 'petted' || active === 'eat' || (mode === 'trick');
  for (const s of [-1, 1]) {
    const ex = s * 11 - 4, ey = -R * 1.12;
    if (closed || happy) {
      g.strokeStyle = '#1b1a24'; g.lineWidth = 2.6; g.lineCap = 'round';
      g.beginPath();
      if (happy && !closed) g.arc(ex, ey + 2, 5, Math.PI * 1.15, Math.PI * 1.85); else g.arc(ex, ey - 2, 5, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    } else {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey, 6.5, 7.5, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1b1a24'; g.beginPath(); g.arc(ex + lx, ey + ly + 1, 3.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + lx + 1.3, ey + ly - 0.6, 1.2, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = 'rgb(255 120 150 / .45)';
  g.beginPath(); g.ellipse(-22, -R * 0.85, 5, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(14, -R * 0.85, 5, 3, 0, 0, Math.PI * 2); g.fill();
  // mouth
  g.strokeStyle = '#1b1a24'; g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath();
  if (active === 'eat') g.ellipse(-4, -R * 0.78, 4, 3 + Math.abs(Math.sin(b.t * 18)) * 3, 0, 0, Math.PI * 2);
  else if (active === 'hype' || active === 'dance') { g.arc(-4, -R * 0.86, 5, 0.1, Math.PI - 0.1); }
  else if (active === 'sleep') g.arc(-4, -R * 0.78, 2, 0, Math.PI * 2);
  else g.arc(-4, -R * 0.86, 3.5, 0.2, Math.PI - 0.2);
  g.stroke();
  // outfits
  if (active === 'nerd') { // glasses and a tiny laptop
    g.strokeStyle = '#1b1a24'; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 11 - 4, -R * 1.12, 8.5, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(-6.5, -R * 1.12); g.lineTo(-1.5, -R * 1.12); g.stroke();
    g.fillStyle = '#2b2d3a'; g.fillRect(-26, -16, 30, 4); g.fillStyle = '#3d4152'; g.fillRect(-24, -34, 26, 18);
    g.fillStyle = '#6fd6ff'; g.fillRect(-22, -32, 22, 14);
  }
  if (active === 'dance' || active === 'listen') { // headphones
    g.strokeStyle = '#2b2d3a'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, -R * 1.25, R * 0.95, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.fillStyle = '#ff5fa8';
    g.beginPath(); g.ellipse(-R * 0.98, -R * 1.05, 6, 9, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(R * 0.98, -R * 1.05, 6, 9, 0, 0, Math.PI * 2); g.fill();
  }
  if (active === 'hype') { // a headband
    g.fillStyle = '#ff4d6d'; g.fillRect(-R, -R * 1.62, R * 2, 6);
  }
  if (active === 'watch') { // popcorn
    g.fillStyle = '#e74c3c'; g.fillRect(-30, -22, 16, 18); g.fillStyle = '#fff6d6';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(-28 + i * 3.2, -24 - (i % 2) * 3, 3.2, 0, Math.PI * 2); g.fill(); }
  }
  if (active === 'sleep') { // nightcap
    g.fillStyle = '#5b6cff';
    g.beginPath(); g.moveTo(-R * 0.8, -R * 1.65); g.quadraticCurveTo(0, -R * 2.6, R * 1.3, -R * 1.9); g.lineTo(R * 0.85, -R * 1.6); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(R * 1.32, -R * 1.9, 5, 0, Math.PI * 2); g.fill();
  }
  if (pet.level >= 5 && active !== 'sleep') { // a crown, earned
    g.fillStyle = '#ffd36b';
    g.beginPath(); g.moveTo(-14, -R * 1.85); g.lineTo(-14, -R * 2.3); g.lineTo(-7, -R * 2.05); g.lineTo(0, -R * 2.4); g.lineTo(7, -R * 2.05); g.lineTo(14, -R * 2.3); g.lineTo(14, -R * 1.85); g.closePath(); g.fill();
  }
  if (active === 'salute') { g.fillStyle = shade(c, -15); g.beginPath(); g.ellipse(-R * 0.7, -R * 1.55, 6, 10, -0.6, 0, Math.PI * 2); g.fill(); }
  g.restore();

  // particles
  g.textAlign = 'center';
  for (const p of fx) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life));
    g.fillStyle = p.color;
    g.font = `700 ${p.ch === 'z' ? 16 : 18}px 'Segoe UI Symbol', 'Segoe UI', sans-serif`;
    g.fillText(p.ch, p.x, p.y);
  }
  g.globalAlpha = 1;
  // name tag on hover, and the speech bubble
  if (over && !drag) label(`${pet.name || 'Petter'} · lvl ${pet.level}`, b.x, gy - b.y - R * 2.4 - 6, 'rgb(20 18 30 / .85)', 12);
  if (bubble && now < bubble.until) label(bubble.text, b.x, gy - b.y - R * 2.4 - (over ? 34 : 6), 'rgb(255 255 255 / .96)', 14, '#1b1a24', true);
}
function label(text, x, y, bg, size, color = '#fff', tail = false) {
  g.font = `700 ${size}px 'Segoe UI', sans-serif`;
  const w = g.measureText(text).width + 22, h = size + 14;
  const lx = Math.max(6, Math.min(W - w - 6, x - w / 2)), ly = Math.max(4, y - h);
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(lx, ly, w, h, 12); g.fill();
  if (tail) { g.beginPath(); g.moveTo(x - 6, ly + h); g.lineTo(x, ly + h + 7); g.lineTo(x + 6, ly + h); g.fill(); }
  g.fillStyle = color;
  g.textAlign = 'left';
  g.fillText(text, lx + 11, ly + h - 9);
  g.textAlign = 'center';
}

// ---------- go ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  checkIdle(now);
  update(dt, now);
  draw(now);
  requestAnimationFrame(frame);
}
pet.level = levelFor(pet.xp);
say(pet.name ? pick([`${pet.name} is back!`, 'hi again!', 'missed you!']) : 'Hi! Right-click me to give me a name', 5000);
setMode('trick', 1, 'hop');
requestAnimationFrame(frame);
