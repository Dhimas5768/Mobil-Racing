const player        = document.getElementById('player');
const gameContainer = document.getElementById('gameContainer');
const distanceText  = document.getElementById('distance-text');
const progressBar   = document.getElementById('progress-bar');
const finishLine    = document.getElementById('finish-line');
const road          = document.getElementById('road');
const flashOverlay  = document.getElementById('flash-overlay');
const weatherOverlay  = document.getElementById('weather-overlay');
const daynightOverlay = document.getElementById('daynight-overlay');

// ─── CONFIG JALUR ───────────────────────────────────────────────────
const lanePositions = [4, 40, 72];
let currentLane = 1; 

// ─── STATUS PLAYER & GAMEPLAY BARU ──────────────────────────────────
let playerBottom = 100;
let lives = 3;
let coins = 0;
let highScore = parseInt(localStorage.getItem('roadRush_highScore')) || 0;
let isPaused = false;
let isInvincible = false;
let activePowerUp = null; // 'nitro', 'shield', 'double'
let powerUpTimer = 0;
let currentCar = 'audi';

// ─── CAR CATALOG (menggantikan carSettings) ──────────────────────────────
const CAR_CATALOG = {
    audi:      { name:'Audi R8',      sprite:'Asset/Audi.png',        price:0,   speedMod:0,    shieldBonus:false, speedBar:60, armorBar:40, desc:'Seimbang & stabil untuk pemula' },
    viper:     { name:'Black Viper',  sprite:'Asset/Black_viper.png', price:0,   speedMod:1.2,  shieldBonus:false, speedBar:100,armorBar:20, desc:'Kecepatan max, adrenalin tinggi' },
    police:    { name:'Interceptor',  sprite:'Asset/Police.png',      price:0,   speedMod:0,    shieldBonus:true,  speedBar:55, armorBar:80, desc:'Baju besi bawaan, +1 nyawa ekstra' },
    car:       { name:'Street Racer', sprite:'Asset/Car.png',         price:30,  speedMod:0.6,  shieldBonus:false, speedBar:75, armorBar:35, desc:'Lincah di semua jalur' },
    taxi:      { name:'Taxi Turbo',   sprite:'Asset/taxi.png',        price:55,  speedMod:0.9,  shieldBonus:false, speedBar:88, armorBar:25, desc:'Gesit dan cepat melesat' },
    minivan:   { name:'Mini Van',     sprite:'Asset/Mini_van.png',    price:70,  speedMod:-0.2, shieldBonus:true,  speedBar:38, armorBar:75, desc:'Keluarga tangguh, nyawa ekstra' },
    ambulance: { name:'Ambulance',    sprite:'Asset/Ambulance.png',   price:90,  speedMod:0.3,  shieldBonus:true,  speedBar:62, armorBar:70, desc:'Kebal sementara saat kena tabrak' },
    minitruck: { name:'Mini Truck',   sprite:'Asset/Mini_truck.png',  price:120, speedMod:0.5,  shieldBonus:false, speedBar:70, armorBar:55, desc:'Tenaga besar, benturan kuat' },
    truck:     { name:'Big Rig',      sprite:'Asset/truck.png',       price:180, speedMod:-0.3, shieldBonus:true,  speedBar:35, armorBar:100,desc:'Tank jalanan, sangat tahan banting' },
};
// alias agar kode lama yang pakai carSettings tetap jalan
const carSettings = CAR_CATALOG;

// ─── KOIN & KEPEMILIKAN MOBIL (PERSISTENT) ────────────────────────
let totalCoins = parseInt(localStorage.getItem('roadRush_totalCoins')) || 0;
let ownedCars  = JSON.parse(localStorage.getItem('roadRush_ownedCars') || '[]');
if (ownedCars.length === 0) ownedCars = ['audi', 'viper', 'police']; // default 3 mobil

function savePersistent() {
    localStorage.setItem('roadRush_totalCoins', totalCoins);
    localStorage.setItem('roadRush_ownedCars',  JSON.stringify(ownedCars));
}

let speedMultiplier = 1.0;

// ─── CONFIG MUSUH & AI ──────────────────────────────────────────────
const enemySprites = [
    'Asset/Ambulance.png', 'Asset/Black_viper.png', 'Asset/Car.png',
    'Asset/Mini_truck.png', 'Asset/Mini_van.png', 'Asset/Police.png',
    'Asset/taxi.png', 'Asset/truck.png'
];
let ENEMY_COUNT = 4;
let enemies = [];
let aiActionTimer = 0;

// ─── KOIN & POWER-UP SYSTEM ──────────────────────────────────────────
let collectibles = [];
const itemTypes = ['🪙', '⚡', '🛡️', '✨']; // Coin, Nitro, Shield, Double Score

// ─── ARTIFAK DAN PROYEKTIL BAWAAN ───────────────────────────────────
const BULLET_SPEED = 10.5;
const ROCKET_SPEED = 7.6;
const BULLET_COOLDOWN = 220;
const ROCKET_COOLDOWN = 1100;
const LASER_COOLDOWN = 1900;
const LASER_DURATION = 140;
const EXPLOSION_RADIUS = 450; 

const MAX_ROCKET_AMMO = 3;
const MAX_LASER_AMMO = 2;
const MAX_BOMB_AMMO = 3; 

let bullets = [];
let particles = [];
let lastBulletTime = 0;
let lastRocketTime = 0;
let lastLaserTime = 0;

let bombAmmo = MAX_BOMB_AMMO;
let laserAmmo = MAX_LASER_AMMO;

let ammoPanel = null;
let ammoRechargeTimer = 0;
let audioContext = null;
let soundEnabled = true;
const bgMusic = document.getElementById('bg-music');

// ─── SIKLUS DAN WEATHER ENVIRONMENT ────────────────────────────────
let envTimer = 0;
let currentWeather = 'clear'; // clear, rain, fog
let isNight = false;

// Garage dirender secara dinamis melalui renderGarage()

// ─── AUDIO SYSTEM Bawaan diperbaiki ────────────────────────────────
function ensureAudioContext() {
    if (audioContext) return audioContext;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
}

function playSound(type) {
    if (!soundEnabled) return;
    const ctx = ensureAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'shoot' || type === 'rocket-fire' || type === 'laser') {
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        if (type === 'shoot') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(920, now);
            osc.frequency.exponentialRampToValueAtTime(620, now + 0.12);
        } else if (type === 'rocket-fire') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.24);
        } else {
            osc.type = 'square'; osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
        }
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'hit' || type === 'bomb-hit') {
        const filter = ctx.createBiquadFilter();
        osc.disconnect(gain); osc.connect(filter); filter.connect(gain);
        osc.type = 'square'; filter.type = 'lowpass'; filter.frequency.setValueAtTime(1600, now);
        osc.frequency.setValueAtTime(520, now); gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.start(now); osc.stop(now + 0.16);
    } else if (type === 'coin') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(587, now);
        osc.frequency.setValueAtTime(880, now + 0.08); gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'powerup') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3); gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'win' || type === 'lose') {
        let time = now; const notes = type === 'win' ? [880, 1040, 1176] : [320, 240, 180];
        notes.forEach((freq, index) => {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = type === 'win' ? 'triangle' : 'sawtooth'; o.frequency.setValueAtTime(freq, time);
            g.gain.setValueAtTime(index === 0 ? 0.15 : 0.1, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
            o.start(time); o.stop(time + 0.14); time += 0.08;
        });
    }
}

function startMusic() {
    if (!soundEnabled || !bgMusic) return;
    bgMusic.volume = 0.25; bgMusic.currentTime = 0;
    bgMusic.play().catch(() => {});
}
function stopMusic() { if (bgMusic) bgMusic.pause(); }

// ─── HUD & UI UPDATES ────────────────────────────────────────────────
function updateAmmoPanel() {
    if (!ammoPanel) return;
    ammoPanel.innerHTML = `<span>🔫 Peluru</span> <span>💣 ${bombAmmo}/${MAX_BOMB_AMMO}</span> <span>⚡ ${laserAmmo}/${MAX_LASER_AMMO}</span>`;
}
function updateHUD() {
    document.getElementById('lives-display').innerText = '❤️'.repeat(Math.max(0, lives));
    document.getElementById('coins-display').innerText = `🪙 ${coins}`;
    document.getElementById('highscore-text').innerText = `Tertinggi: ${highScore}`;
    const scoreEl = document.getElementById('score-text');
    if (scoreEl) scoreEl.innerText = `Skor: ${score}`;
}
function showToast(text) {
    const toast = document.getElementById('notification-toast');
    toast.innerText = text; toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
}

function rechargeAmmo(delta) {
    ammoRechargeTimer += delta;
    if (ammoRechargeTimer < 4200) return;
    ammoRechargeTimer = 0;
    if (bombAmmo < MAX_BOMB_AMMO) bombAmmo++;
    if (laserAmmo < MAX_LASER_AMMO) laserAmmo++;
    updateAmmoPanel();
}

// ─── RUNTIME & CONFIG GAME ──────────────────────────────────────────
// Kecepatan dasar dikurangi agar gameplay lebih normal dan nyaman dimainkan
let playerSpeed = 0.1;
let obstacleSpeed = 3.8;
const totalDistance = 1500;
let currentDistance = totalDistance;
let isGameOver = false;
let gameStarted = false;
let isWin = false;
let animationId = null;
let score = 0;
let lastTime = 0;
let speedIncreaseTimer = 0;

// ─── INITIALIZERS FOR SPAWNERS ──────────────────────────────────────
function createEnemies() {
    enemies.forEach(e => e.el.remove()); enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
        const el = document.createElement('div'); el.classList.add('obstacle'); road.appendChild(el);
        const enemy = { el: el, lane: 0, top: 0, sprite: '' };
        spawnEnemy(enemy, -(180 + i * 160 + Math.floor(Math.random() * 80)));
        enemies.push(enemy);
    }
}

function spawnEnemy(enemy, topOverride) {
    const targetTop = (topOverride !== undefined) ? topOverride : -(Math.random() * 120 + 140);
    const otherEnemies = enemies.filter(e => e !== enemy);
    const laneScores = lanePositions.map((pos, lane) => {
        const minDistance = otherEnemies.reduce((min, other) => {
            if (other.lane !== lane) return min;
            return Math.min(min, Math.abs(targetTop - other.top));
        }, Infinity);
        return { lane, minDistance };
    });
    laneScores.sort((a, b) => b.minDistance - a.minDistance);
    const chosen = laneScores[0].minDistance >= 140 ? laneScores[0] : laneScores[Math.floor(Math.random() * 3)];
    
    enemy.lane = chosen.lane;
    enemy.el.style.left = lanePositions[chosen.lane] + '%';
    enemy.sprite = enemySprites[Math.floor(Math.random() * enemySprites.length)];
    enemy.el.style.backgroundImage = `url('${enemy.sprite}')`;
    enemy.top = targetTop; enemy.el.style.top = enemy.top + 'px';
}

// MANAGEMENT KOIN & POWERUPS
function spawnCollectible() {
    if (collectibles.length >= 3 || Math.random() > 0.45) return;
    const el = document.createElement('div'); el.className = 'collectible';
    const randType = Math.random();
    let type = '🪙';
    if (randType > 0.75) {
        const pUps = ['⚡', '🛡️', '✨'];
        type = pUps[Math.floor(Math.random() * pUps.length)];
    }
    el.innerText = type; const targetLane = Math.floor(Math.random() * 3);
    el.style.left = (lanePositions[targetLane] + 4) + '%';
    const startTop = -(Math.random() * 200 + 100); el.style.top = startTop + 'px';
    road.appendChild(el);
    collectibles.push({ el, lane: targetLane, top: startTop, type });
}

function updateCollectibles() {
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const item = collectibles[i]; item.top += obstacleSpeed;
        item.el.style.top = item.top + 'px';
        
        // Deteksi Pengambilan Item
        const pRect = player.getBoundingClientRect();
        const iRect = item.el.getBoundingClientRect();
        if (pRect.left < iRect.right && pRect.right > iRect.left && pRect.top < iRect.bottom && pRect.bottom > iRect.top) {
            handleItemPickup(item.type); item.el.remove(); collectibles.splice(i, 1); continue;
        }
        if (item.top > road.offsetHeight + 40) { item.el.remove(); collectibles.splice(i, 1); }
    }
}

function handleItemPickup(type) {
    if (type === '🪙') {
        coins += 1; score += 50; playSound('coin');
        if (coins === 1) triggerAchievement('Koin Pertama Anda!');
        if (coins === 15) triggerAchievement('Kolektor Koin Cilik');
    } else {
        playSound('powerup');
        const badge = document.getElementById('active-powerup-badge');
        if (type === '⚡') { activePowerUp = 'nitro'; powerUpTimer = 4000; badge.innerText = '⚡ NITRO'; badge.style.color = '#ffcc00'; player.classList.add('player-turbo'); }
        if (type === '🛡️') { activePowerUp = 'shield'; powerUpTimer = 6000; badge.innerText = '🛡️ SHIELD'; badge.style.color = '#00ffff'; }
        if (type === '✨') { activePowerUp = 'double'; powerUpTimer = 7000; badge.innerText = '✨ 2X SCORE'; badge.style.color = '#ff00ff'; }
        badge.style.display = 'block';
    }
    updateHUD();
}

// ─── INTELIGENCE ARTIFICIAL (SMART ENEMY) ─────────────────────────
function updateEnemyAI(delta) {
    aiActionTimer += delta;
    
    // AI merespon lebih cepat di Hard, lebih lambat di Easy
    let aiInterval = 1800;
    if (speedMultiplier === 1.0) aiInterval = 900;       // Hard
    else if (speedMultiplier === 0.7) aiInterval = 2800; // Easy
    
    if (aiActionTimer < aiInterval) return;
    aiActionTimer = 0;

    enemies.forEach(enemy => {
        if (enemy.top > 50 && enemy.top < road.offsetHeight - 250) {
            
            // Peluang musuh berpindah jalur
            let switchChance = 0.25;
            if (speedMultiplier === 1.0) switchChance = 0.55; // Sangat agresif di Hard
            else if (speedMultiplier === 0.7) switchChance = 0.10; // Pasif di Easy
            
            if (Math.random() < switchChance) {
                const currentAI_Lane = enemy.lane;
                let nextLane = -1;
                
                // Di mode Hard, musuh mencoba menutupi jalur pemain! (Blocking behavior)
                if (speedMultiplier === 1.0 && Math.random() < 0.65) {
                    if (currentLane > currentAI_Lane) nextLane = currentAI_Lane + 1;
                    else if (currentLane < currentAI_Lane) nextLane = currentAI_Lane - 1;
                }
                
                // Pergerakan acak jika bukan targeting
                if (nextLane === -1) {
                    const directions = [];
                    if (currentAI_Lane > 0) directions.push(-1);
                    if (currentAI_Lane < 2) directions.push(1);
                    const sideShift = directions[Math.floor(Math.random() * directions.length)];
                    nextLane = currentAI_Lane + sideShift;
                }

                // Cek agar tidak tabrakan sesama musuh
                const isLaneSafe = enemies.every(other => {
                    if (other === enemy || other.lane !== nextLane) return true;
                    return Math.abs(other.top - enemy.top) > 150;
                });

                if (isLaneSafe) {
                    enemy.lane = nextLane; enemy.el.style.left = lanePositions[nextLane] + '%';
                }
            }
        }
    });
}

// ─── CINEMATIC FX: EXPLOSIONS & SHAKE & FLASH ─────────────────────
function triggerCinematicCollision() {
    gameContainer.classList.add('shake');
    flashOverlay.classList.add('flash-active');
    setTimeout(() => gameContainer.classList.remove('shake'), 400);
    setTimeout(() => flashOverlay.classList.remove('flash-active'), 300);
}

function spawnDriveParticles() {
    const count = activePowerUp === 'nitro' ? 3 : 1;
    if (Math.random() > 0.4) return;
    const roadRect = road.getBoundingClientRect();
    const pRect = player.getBoundingClientRect();
    const leftPos = pRect.left - roadRect.left + (pRect.width / 2) + (Math.random() * 16 - 8);
    const topPos = pRect.bottom - roadRect.top - 10;
    
    const pEl = document.createElement('div'); pEl.className = 'particle';
    if (activePowerUp === 'nitro') { pEl.style.background = '#00ffff'; pEl.style.boxShadow = '0 0 8px #00ffff'; }
    pEl.style.left = leftPos + 'px'; pEl.style.top = topPos + 'px';
    road.appendChild(pEl); particles.push({ el: pEl, top: topPos, life: 1.0 });
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.top += 3.5; p.life -= 0.05;
        p.el.style.top = p.top + 'px'; p.el.style.opacity = p.life;
        if (p.life <= 0) { p.el.remove(); particles.splice(i, 1); }
    }
}

// POHON & BACKGROUND UTILITIES — Menggunakan gambar Pohon1.jpeg & Pohon2.jpeg
const TREE_COUNT = 14;       // lebih banyak pohon
const TREE_SPACING = 72;     // jarak lebih rapat
const treeImages = ['Asset/Pohon1.png', 'Asset/Pohon2.png'];
let trees = [];

function createTreeElement() {
    const wrap = document.createElement('div');
    wrap.className = 'tree';

    // Variasi ukuran natural
    const scale = 0.75 + Math.random() * 0.45;
    const w = Math.round(54 * scale);
    const h = Math.round(72 * scale);
    wrap.style.width  = w + 'px';
    wrap.style.height = h + 'px';

    // Pilih gambar secara bergantian acak
    const imgSrc = treeImages[Math.floor(Math.random() * treeImages.length)];
    wrap.style.backgroundImage    = `url('${imgSrc}')`;
    wrap.style.backgroundSize     = 'cover';
    wrap.style.backgroundPosition = 'center bottom';
    wrap.style.backgroundRepeat   = 'no-repeat';

    // Bayangan agar tampak 3D
    wrap.style.filter = `drop-shadow(0 ${Math.round(3*scale)}px ${Math.round(7*scale)}px rgba(0,0,0,0.55))`;

    // Sedikit kemiringan acak agar tidak kaku
    const tilt = (Math.random() * 6 - 3).toFixed(1);
    wrap.style.transform = `translateX(-50%) rotate(${tilt}deg)`;

    return wrap;
}

function createTrees() {
    const leftEl  = document.querySelector('.sidewalk-left');
    const rightEl = document.querySelector('.sidewalk-right');
    if (!leftEl || !rightEl) return;
    trees.forEach(t => t.el.remove()); trees = [];

    // Ambil tinggi layar — ini rentang yang harus ditutupi pohon
    const screenH = leftEl.offsetHeight || window.innerHeight;

    // Rentang distribusi: dari sedikit di atas layar (-TREE_SPACING)
    // sampai bawah layar (screenH), agar pohon langsung tampak penuh
    const totalRange = screenH + TREE_SPACING;

    for (let i = 0; i < TREE_COUNT; i++) {
        ['left', 'right'].forEach(side => {
            const container = side === 'left' ? leftEl : rightEl;
            const el  = createTreeElement();
            const offsetX = (Math.random() * 8 - 4);
            el.style.left = `calc(50% + ${offsetX}px)`;

            // Bagi rentang secara merata + sedikit jitter agar tidak kaku
            const jitter = Math.floor(Math.random() * (TREE_SPACING * 0.35));
            const top = -TREE_SPACING + Math.floor(i * (totalRange / TREE_COUNT)) + jitter;

            el.style.top = top + 'px';
            container.appendChild(el);
            trees.push({ el, top, side });
        });
    }
}


function updateTrees() {
    const containerH = road.offsetHeight || window.innerHeight;
    trees.forEach(tree => {
        tree.top += obstacleSpeed;
        tree.el.style.top = tree.top + 'px';
        if (tree.top > containerH + 80) {
            const sameSide = trees.filter(t => t.side === tree.side && t !== tree);
            const minTop   = sameSide.reduce((m, t) => Math.min(m, t.top), 0);
            tree.top = minTop - TREE_SPACING;
            const newEl = createTreeElement();
            const offsetX = (Math.random() * 8 - 4);
            newEl.style.left = `calc(50% + ${offsetX}px)`;
            newEl.style.top  = tree.top + 'px';
            tree.el.replaceWith(newEl);
            tree.el = newEl;
        }
    });
}

// LOGIKA TEMBAKAN SENJATA & BULLETS ENGINE
function createBulletElement() {
    const el = document.createElement('div'); el.className = 'bullet'; road.appendChild(el); return el;
}
function shootBullet() {
    if (!gameStarted || isGameOver || isWin || isPaused) return;
    const now = performance.now(); if (now - lastBulletTime < BULLET_COOLDOWN) return;
    lastBulletTime = now; playSound('shoot');
    const roadRect = road.getBoundingClientRect(); const playerRect = player.getBoundingClientRect();
    const startLeft = playerRect.left - roadRect.left + playerRect.width / 2 - 5;
    const startTop = playerRect.top - roadRect.top + 8;
    const el = createBulletElement(); el.classList.add('bullet-shot');
    el.style.left = `${startLeft}px`; el.style.top = `${startTop}px`;
    bullets.push({ el, top: startTop, type: 'bullet' });
}
function fireBomb() {
    if (!gameStarted || isGameOver || isWin || isPaused) return;
    const now = performance.now(); if (bombAmmo <= 0 || now - lastRocketTime < ROCKET_COOLDOWN) return;
    lastRocketTime = now; bombAmmo -= 1; updateAmmoPanel(); playSound('rocket-fire');
    const roadRect = road.getBoundingClientRect(); const playerRect = player.getBoundingClientRect();
    const startLeft = playerRect.left - roadRect.left + playerRect.width / 2 - 10;
    const startTop = playerRect.top - roadRect.top + 8;
    const el = createBulletElement(); el.className = 'bomb';
    el.style.left = `${startLeft}px`; el.style.top = `${startTop}px`;
    bullets.push({ el, top: startTop, type: 'rocket' });
}
function fireLaser() {
    if (!gameStarted || isGameOver || isWin || isPaused) return;
    const now = performance.now(); if (laserAmmo <= 0 || now - lastLaserTime < LASER_COOLDOWN) return;
    lastLaserTime = now; laserAmmo -= 1; updateAmmoPanel(); playSound('laser');
    const beam = document.createElement('div'); beam.className = 'laser-beam';
    beam.style.left = `${(lanePositions[currentLane] + 7)}%`; beam.style.top = '0px'; beam.style.height = `${road.offsetHeight}px`;
    road.appendChild(beam);
    const playerTopRelative = road.offsetHeight - playerBottom - player.offsetHeight;
    enemies.forEach(enemy => {
        if (enemy.lane === currentLane && enemy.top < playerTopRelative) {
            spawnEnemy(enemy, -(Math.random() * 160 + 120)); score += 35;
        }
    });
    updateHUD(); setTimeout(() => beam.remove(), LASER_DURATION);
}
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i]; const speed = bullet.type === 'rocket' ? ROCKET_SPEED : BULLET_SPEED;
        bullet.top -= speed;
        if (bullet.top < -40) {
            if (bullet.type === 'rocket') { const rect = bullet.el.getBoundingClientRect(); explodeAt(rect.left + rect.width / 2, rect.top + rect.height / 2); }
            bullet.el.remove(); bullets.splice(i, 1); continue;
        }
        bullet.el.style.top = bullet.top + 'px';
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            if (bullets[i] && checkBulletHit(bullet, enemy)) {
                playSound('hit');
                if (bullet.type === 'rocket') { const rect = bullet.el.getBoundingClientRect(); explodeAt(rect.left + rect.width / 2, rect.top + rect.height / 2); }
                bullet.el.remove(); bullets.splice(i, 1);
                if (bullet.type !== 'rocket') { spawnEnemy(enemy, -(Math.random() * 160 + 120)); score += 20; }
                updateHUD(); break;
            }
        }
    }
}
function checkBulletHit(bullet, enemy) {
    const bRect = bullet.el.getBoundingClientRect(); const eRect = enemy.el.getBoundingClientRect();
    return (bRect.left < eRect.right && bRect.right > eRect.left && bRect.top < eRect.bottom && bRect.bottom > eRect.top);
}
function explodeAt(x, y) {
    const explosion = document.createElement('div'); explosion.className = 'explosion';
    const roadRect = road.getBoundingClientRect(); explosion.style.left = `${x - roadRect.left}px`; explosion.style.top = `${y - roadRect.top}px`;
    road.appendChild(explosion);
    enemies.forEach(enemy => {
        const enemyRect = enemy.el.getBoundingClientRect();
        const dx = (enemyRect.left + enemyRect.width / 2) - x; const dy = (enemyRect.top + enemyRect.height / 2) - y;
        if (Math.sqrt(dx * dx + dy * dy) <= EXPLOSION_RADIUS) { spawnEnemy(enemy, -(Math.random() * 160 + 120)); score += 25; }
    });
    updateHUD(); setTimeout(() => explosion.remove(), 400);
}

// ─── ENVIRONMENT CYCLES (WEATHER & SIANG MALAM) ───────────────────
function updateEnvironment(delta) {
    envTimer += delta;
    if (envTimer > 15000) { // Berubah siklus cuaca/waktu setiap 15 detik
        envTimer = 0;
        const rand = Math.random();
        if (rand < 0.6) {
            currentWeather = 'clear'; weatherOverlay.className = '';
        } else {
            currentWeather = 'fog'; weatherOverlay.className = 'weather-fog';
            showToast('🌫️ Cuaca: Kabut Tebal!');
        }
        
        isNight = !isNight;
        if (isNight) { daynightOverlay.classList.add('night-mode'); } 
        else { daynightOverlay.classList.remove('night-mode'); }
    }
}

// ─── ACHIEVEMENT RECOGNITION ──────────────────────────────────────
const achievements = { reached500m: false, collectCoins: false };
function triggerAchievement(title) {
    showToast(`🏅 ACHIEVEMENT: ${title}`);
}

// ─── PROGRESSIVE DIFFICULTY SCALE ─────────────────────────────────
function handleDifficultyAndPowerUp(delta) {
    if (activePowerUp) {
        powerUpTimer -= delta;
        if (powerUpTimer <= 0) {
            activePowerUp = null;
            document.getElementById('active-powerup-badge').style.display = 'none';
            player.classList.remove('player-turbo');
        }
    }
    
    // Kecepatan dasar disesuaikan agar permainan tidak terlalu cepat
    let baseSpeed = 5.1 + (carSettings[currentCar].speedMod * 0.7);
    if (activePowerUp === 'nitro') baseSpeed *= 1.5;

    // Tingkat kesulitan pengali seiring jarak
    const distanceTraveled = totalDistance - currentDistance;
    let diffScale = 1.0;
    if (speedMultiplier === 0.7) diffScale = 0.4; // Kenaikan kesulitan lambat di Easy
    else if (speedMultiplier === 1.0) diffScale = 1.8; // Kenaikan kesulitan cepat di Hard
    
    const difficultyMultiplier = 1 + (distanceTraveled / 500) * 0.12 * diffScale;
    
    playerSpeed = baseSpeed * difficultyMultiplier * speedMultiplier;
    obstacleSpeed = Math.min(playerSpeed * 0.7, 9.5);
}

// ─── PAUSE SYSTEM AREA ─────────────────────────────────────────────
function togglePause() {
    if (!gameStarted || isGameOver || isWin) return;
    isPaused = !isPaused;
    if (isPaused) {
        cancelAnimationFrame(animationId); stopMusic();
        gameContainer.classList.add('paused');
        document.getElementById('pause-menu').style.display = 'flex';
    } else {
        gameContainer.classList.remove('paused');
        document.getElementById('pause-menu').style.display = 'none';
        lastTime = performance.now(); startMusic();
        animationId = requestAnimationFrame(gameLoop);
    }
}
document.getElementById('resumeBtn').addEventListener('click', togglePause);

// ─── GAME MAIN LOOP ENGINE ─────────────────────────────────────────
function gameLoop(timestamp) {
    if (isGameOver || isWin || isPaused) return;
    const delta = timestamp - lastTime; lastTime = timestamp;

    currentDistance -= playerSpeed * 0.05;
    updateProgress();
    handleDifficultyAndPowerUp(delta);
    updateRoadSpeedEffect();

    if (currentDistance < 80) {
        finishLine.style.display = 'block';
        let ft = parseFloat(finishLine.style.top) || -100; ft += obstacleSpeed;
        finishLine.style.top = ft + 'px';
    }
    if (currentDistance <= 0) { triggerWin(); return; }

    if ((totalDistance - currentDistance) >= 500 && !achievements.reached500m) {
        achievements.reached500m = true; triggerAchievement('Pembalap Tangguh (500m)');
    }

    rechargeAmmo(delta); updateTrees(); updateBullets(); updateEnemyAI(delta);
    updateCollectibles(); updateParticles(); spawnDriveParticles();
    updateEnvironment(delta);

    if (Math.random() < 0.015) spawnCollectible();

    const roadHeight = road.offsetHeight;
    enemies.forEach(enemy => {
        enemy.top += obstacleSpeed; enemy.el.style.top = enemy.top + 'px';
        if (enemy.top > roadHeight + 20) {
            spawnEnemy(enemy);
            score += activePowerUp === 'double' ? 20 : 10;
            updateHUD();
        }
        checkCollision(enemy);
    });
    animationId = requestAnimationFrame(gameLoop);
}

// ─── TABRAKAN DENGAN HEALTH SYSTEM ──────────────────────────────────
function checkCollision(enemy) {
    if (isInvincible) return;
    const pRect = player.getBoundingClientRect(); const oRect = enemy.el.getBoundingClientRect();
    const shrink = 12;

    if (pRect.left + shrink < oRect.right - shrink && pRect.right - shrink > oRect.left + shrink &&
        pRect.top + shrink < oRect.bottom - shrink && pRect.bottom - shrink > oRect.top + shrink) {
        
        if (activePowerUp === 'shield') {
            activePowerUp = null; document.getElementById('active-powerup-badge').style.display = 'none';
            triggerCinematicCollision(); playSound('hit'); triggerInvincibility(1200);
            spawnEnemy(enemy); return;
        }

        // Kurangi nyawa
        lives--; updateHUD(); triggerCinematicCollision(); playSound('hit');
        
        if (lives <= 0) { gameOver(); } 
        else { triggerInvincibility(1800); spawnEnemy(enemy); }
    }
}

function triggerInvincibility(duration) {
    isInvincible = true; player.classList.add('flicker');
    setTimeout(() => { isInvincible = false; player.classList.remove('flicker'); }, duration);
}

// RESET & CONFIG MULAI BALAPAN
function resetGame() {
    // Sesuaikan jumlah musuh berdasarkan tingkat kesulitan
    if (speedMultiplier === 0.7) ENEMY_COUNT = 3;       // Easy: Sepi musuh
    else if (speedMultiplier === 1.0) ENEMY_COUNT = 5;  // Hard: Ramai & sempit
    else ENEMY_COUNT = 4;                               // Normal

    currentDistance = totalDistance; lives = carSettings[currentCar].shieldBonus ? 4 : 3;
    coins = 0; score = 0; isGameOver = false; isWin = false; isPaused = false;
    activePowerUp = null; envTimer = 0; currentWeather = 'clear'; isNight = false;
    weatherOverlay.className = ''; daynightOverlay.className = '';
    
    player.style.backgroundImage = `url('${carSettings[currentCar].sprite}')`;
    player.classList.remove('player-turbo');
    document.getElementById('active-powerup-badge').style.display = 'none';
    finishLine.style.display = 'none'; finishLine.style.top = '-100px';
    road.style.setProperty('--speed-line-opacity', '0'); road.style.setProperty('--road-line-speed', '1');

    currentLane = 1; playerBottom = 100; updatePlayerPosition(); updateProgress(); updateHUD();
    hideEndScreens();
    gameContainer.classList.remove('paused');
    document.getElementById('pause-menu').style.display = 'none';

    ammoPanel = document.getElementById('ammo-panel');
    bombAmmo = MAX_BOMB_AMMO; laserAmmo = MAX_LASER_AMMO; updateAmmoPanel();
    startMusic();

    bullets.forEach(b => b.el.remove()); bullets = [];
    collectibles.forEach(c => c.el.remove()); collectibles = [];
    particles.forEach(p => p.el.remove()); particles = [];
    
    createTrees(); createEnemies();
}

function startGame() {
    resetGame(); gameStarted = true;
    document.getElementById('rules').style.display = 'none';
    lastTime = performance.now(); animationId = requestAnimationFrame(gameLoop);
}

// NAVIGATION CONTROLS INTERFACES
function updatePlayerPosition() { player.style.left = lanePositions[currentLane] + '%'; player.style.bottom = playerBottom + 'px'; }
function moveLeft() { if (currentLane > 0 && !isPaused) { currentLane--; updatePlayerPosition(); } }
function moveRight() { if (currentLane < 2 && !isPaused) { currentLane++; updatePlayerPosition(); } }
function moveUp() { const maxB = road.offsetHeight - 130; if (playerBottom < maxB && !isPaused) { playerBottom = Math.min(playerBottom + 25, maxB); updatePlayerPosition(); } }
function moveDown() { if (playerBottom > 60 && !isPaused) { playerBottom = Math.max(playerBottom - 25, 60); updatePlayerPosition(); } }

// KEYBOARD REGISTER LISTENER
document.addEventListener('keydown', (e) => {
    if (!gameStarted || isGameOver || isWin) {
        if (e.code === 'Space' || e.key === 'Enter') { hideEndScreens(); startGame(); }
        return;
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { e.preventDefault(); togglePause(); return; }
    if (isPaused) return;
    switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); moveLeft(); break;
        case 'ArrowRight': e.preventDefault(); moveRight(); break;
        case 'ArrowUp': e.preventDefault(); moveUp(); break;
        case 'ArrowDown': e.preventDefault(); moveDown(); break;
        case 'z': case 'Z': e.preventDefault(); shootBullet(); break;
        case 'x': case 'X': e.preventDefault(); fireBomb(); break;
        case 'c': case 'C': e.preventDefault(); fireLaser(); break;
        case 'm': case 'M': toggleSound(); break;
    }
});

function addTouchBtn(id, fn) {
    const btn = document.getElementById(id); if (!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); if (gameStarted && !isGameOver && !isWin && !isPaused) fn(); });
    btn.addEventListener('click', () => { if (gameStarted && !isGameOver && !isWin && !isPaused) fn(); });
}
addTouchBtn('btn-left', moveLeft); addTouchBtn('btn-right', moveRight); addTouchBtn('btn-up', moveUp); addTouchBtn('btn-down', moveDown);
addTouchBtn('btn-shoot', shootBullet); addTouchBtn('btn-bomb', fireBomb); addTouchBtn('btn-laser', fireLaser);
const speedOptions = document.querySelectorAll('.speed-option');
speedOptions.forEach(option => {
    option.addEventListener('click', () => {
        speedOptions.forEach(btn => btn.classList.remove('active'));
        option.classList.add('active');
        speedMultiplier = parseFloat(option.getAttribute('data-speed'));
    });
});

document.getElementById('startBtn').addEventListener('click', startGame);

function toggleSound() {
    soundEnabled = !soundEnabled; const icon = document.getElementById('sound-toggle');
    if (icon) icon.innerText = soundEnabled ? '🔊' : '🔇';
    if (soundEnabled) startMusic(); else stopMusic();
}
document.getElementById('sound-toggle').addEventListener('click', toggleSound);

function updateProgress() {
    const distanceLeft = Math.max(0, Math.floor(currentDistance));
    distanceText.innerText = `Jarak: ${distanceLeft} m`;
    const percent = ((totalDistance - currentDistance) / totalDistance) * 100;
    progressBar.style.width = Math.min(percent, 100) + '%';
}
function updateRoadSpeedEffect() {
    const speedFactor = 1 + Math.max(0, playerSpeed - 4) * 0.16;
    road.style.setProperty('--road-line-speed', speedFactor.toFixed(3));
}

// ─── GAME OVER & WIN SYSTEMS ────────────────────────────────────────
const gameoverScreen = document.getElementById('gameover-screen');
const winScreen      = document.getElementById('win-screen');

function showGameOverScreen() {
    document.getElementById('go-score').textContent     = score;
    document.getElementById('go-highscore').textContent = highScore;
    document.getElementById('go-coins').textContent     = coins;
    const isNewRecord = score >= highScore && score > 0;
    document.getElementById('go-newrecord').style.display = isNewRecord ? 'block' : 'none';
    gameoverScreen.style.display = 'flex';
}

function showWinScreen() {
    document.getElementById('win-score').textContent     = score;
    document.getElementById('win-highscore').textContent = highScore;
    document.getElementById('win-coins').textContent     = coins;
    const isNewRecord = score >= highScore && score > 0;
    document.getElementById('win-newrecord').style.display = isNewRecord ? 'block' : 'none';
    winScreen.style.display = 'flex';
}

function hideEndScreens() {
    gameoverScreen.style.display = 'none';
    winScreen.style.display      = 'none';
}

function triggerWin() {
    isWin = true;
    cancelAnimationFrame(animationId);
    stopMusic();
    gameContainer.classList.add('paused');
    playSound('win');
    
    totalCoins += coins;
    savePersistent();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('roadRush_highScore', highScore);
    }
    setTimeout(showWinScreen, 350);
}

function gameOver() {
    if (isGameOver) return;
    isGameOver = true;
    cancelAnimationFrame(animationId);
    stopMusic();
    gameContainer.classList.add('paused');
    playSound('lose');
    
    totalCoins += coins;
    savePersistent();

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('roadRush_highScore', highScore);
    }
    player.style.transform = 'rotate(25deg) scale(0.85)';
    setTimeout(() => {
        player.style.transform = '';
        showGameOverScreen();
    }, 350);
}

// Tombol Retry & Menu
function goToMenu() {
    hideEndScreens();
    gameContainer.classList.remove('paused');
    gameStarted = false;
    document.getElementById('rules').style.display = 'flex';
    renderGarage();
}

document.getElementById('go-retry').addEventListener('click',  () => { hideEndScreens(); startGame(); });
document.getElementById('go-menu').addEventListener('click',   goToMenu);
document.getElementById('win-retry').addEventListener('click', () => { hideEndScreens(); startGame(); });
document.getElementById('win-menu').addEventListener('click',  goToMenu);

// Init view
document.getElementById('highscore-text').innerText = `Tertinggi: ${highScore}`;
createTrees();

// ─── UI & SHOP LOGIC ──────────────────────────────────────────────────
function updateMenuWallet() {
    document.getElementById('menu-total-coins').textContent = totalCoins;
    document.getElementById('shop-coin-display').textContent = totalCoins;
}

function renderGarage() {
    const container = document.getElementById('garage-selector');
    if (!container) return;
    container.innerHTML = '';
    
    // Hanya tampilkan mobil yang dimiliki di garage menu utama
    ownedCars.forEach(carId => {
        const car = CAR_CATALOG[carId];
        const card = document.createElement('div');
        card.className = `garage-card ${currentCar === carId ? 'active' : ''}`;
        card.dataset.car = carId;
        
        card.innerHTML = `
            <div class="car-thumb" style="background-image: url('${car.sprite}')"></div>
            <span>${car.name}</span>
            <p class="car-desc">${car.desc}</p>
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.garage-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentCar = carId;
            // Update mobil pemain langsung di background jika berubah
            player.style.backgroundImage = `url('${car.sprite}')`;
            renderShop(); 
        });
        
        container.appendChild(card);
    });
    updateMenuWallet();
}

function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    Object.keys(CAR_CATALOG).forEach(carId => {
        const car = CAR_CATALOG[carId];
        const isOwned = ownedCars.includes(carId);
        const isActive = currentCar === carId;
        
        const card = document.createElement('div');
        card.className = `shop-card ${isOwned ? 'owned' : 'locked'} ${isActive ? 'selected-car' : ''}`;
        
        let badgeHTML = '';
        if (isActive) badgeHTML = `<div class="shop-badge badge-active">Dipakai</div>`;
        else if (isOwned) badgeHTML = `<div class="shop-badge badge-owned">Dimiliki</div>`;
        else badgeHTML = `<div class="shop-badge badge-locked">Terkunci</div>`;
        
        let actionBtnHTML = '';
        if (isActive) {
            actionBtnHTML = `<button class="shop-action-btn btn-active" disabled>Terpilih</button>`;
        } else if (isOwned) {
            actionBtnHTML = `<button class="shop-action-btn btn-select" onclick="selectCar('${carId}')">Gunakan</button>`;
        } else {
            const canAfford = totalCoins >= car.price;
            actionBtnHTML = `<button class="shop-action-btn ${canAfford ? 'btn-buy' : 'btn-locked'}" 
                             ${canAfford ? `onclick="buyCar('${carId}')"` : 'disabled'}>
                             Beli (🪙 ${car.price})
                             </button>`;
        }
        
        card.innerHTML = `
            ${badgeHTML}
            <div class="shop-car-img" style="background-image: url('${car.sprite}')"></div>
            <div class="shop-car-name">${car.name}</div>
            <p class="shop-car-desc">${car.desc}</p>
            
            <div class="shop-stats">
                <div class="stat-row">
                    <span class="stat-row-label">SPD</span>
                    <div class="stat-bar-bg"><div class="stat-bar-fill bar-speed" style="width: ${car.speedBar}%"></div></div>
                </div>
                <div class="stat-row">
                    <span class="stat-row-label">ARM</span>
                    <div class="stat-bar-bg"><div class="stat-bar-fill bar-armor" style="width: ${car.armorBar}%"></div></div>
                </div>
            </div>
            
            <div class="shop-price" style="display: ${isOwned ? 'none' : 'block'}">Harga: 🪙 ${car.price}</div>
            ${actionBtnHTML}
        `;
        
        grid.appendChild(card);
    });
}

window.selectCar = function(carId) {
    if (ownedCars.includes(carId)) {
        currentCar = carId;
        renderGarage();
        renderShop();
    }
};

window.buyCar = function(carId) {
    const car = CAR_CATALOG[carId];
    if (!ownedCars.includes(carId) && totalCoins >= car.price) {
        totalCoins -= car.price;
        ownedCars.push(carId);
        savePersistent();
        selectCar(carId);
        playSound('powerup');
    } else {
        playSound('hit');
    }
};

const openShopBtn = document.getElementById('open-shop-btn');
if (openShopBtn) {
    openShopBtn.addEventListener('click', () => {
        renderShop();
        document.getElementById('shop-overlay').style.display = 'flex';
    });
}

const shopBackBtn = document.getElementById('shop-back-btn');
if (shopBackBtn) {
    shopBackBtn.addEventListener('click', () => {
        document.getElementById('shop-overlay').style.display = 'none';
    });
}

// Panggil render saat awal
renderGarage();