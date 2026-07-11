/**
 * Modern Minesweeper Pro - Advanced Logic with Lucide Icons
 */

const DIFFICULTIES = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

let board = [];
let currentDiffKey = 'easy';
let config = DIFFICULTIES[currentDiffKey];
let minesLeft = 0;
let cellsOpened = 0;
let isGameOver = false;
let isFirstClick = true;
let timerInterval = null;
let timeElapsed = 0;

// Audio Context API (Modern Synthesizer)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    
    if (type === 'open') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'flag') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.15);
        osc.frequency.setValueAtTime(1000, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    } else if (type === 'lose') {
        // --- SUARA LEDAKAN GRANAT (Procedural Audio) ---
        // Membuat durasi buffer 1.5 detik
        const bufferSize = audioCtx.sampleRate * 1.5; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Mengisi buffer dengan distorsi/White Noise (suara dasar ledakan)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;

        // Membuat filter untuk meredam noise menjadi suara "boom" atau bass berat
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        // Frekuensi dimulai dari 1000Hz (ledakan awal) lalu turun drastis ke 100Hz (gema bass)
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 1.5);

        // Mengatur volume ledakan (keras di awal, lalu memudar)
        gain.gain.setValueAtTime(1, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

        // Menyambungkan semua komponen audio
        noiseSource.connect(filter);
        filter.connect(gain);
        
        // Mulai mainkan suara granat
        noiseSource.start(now);
        noiseSource.stop(now + 1.5);
    }
}

function createBoardData() {
    board = [];
    for (let r = 0; r < config.rows; r++) {
        let row = [];
        for (let c = 0; c < config.cols; c++) {
            row.push({ r: r, c: c, isMine: false, isOpen: false, isFlagged: false, neighborMines: 0 });
        }
        board.push(row);
    }
}

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.id = `cell-${r}-${c}`;
            cell.setAttribute('role', 'button');
            cell.setAttribute('tabindex', '0');
            
            cell.addEventListener('click', () => handleCellClick(r, c));
            cell.addEventListener('contextmenu', (e) => { e.preventDefault(); toggleFlag(r, c); });
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleCellClick(r, c);
                if (e.key === ' ') { e.preventDefault(); toggleFlag(r, c); }
            });
            boardEl.appendChild(cell);
        }
    }
}

function placeMines(firstR, firstC) {
    let placed = 0;
    while (placed < config.mines) {
        let r = Math.floor(Math.random() * config.rows);
        let c = Math.floor(Math.random() * config.cols);
        if (!board[r][c].isMine && (r !== firstR || c !== firstC)) {
            board[r][c].isMine = true;
            placed++;
        }
    }
}

function calculateNumbers() {
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (!board[r][c].isMine) {
                let count = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        let nr = r + i, nc = c + j;
                        if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                            if (board[nr][nc].isMine) count++;
                        }
                    }
                }
                board[r][c].neighborMines = count;
            }
        }
    }
}

function handleCellClick(r, c) {
    if (isGameOver || board[r][c].isOpen || board[r][c].isFlagged) return;

    if (isFirstClick) {
        isFirstClick = false;
        placeMines(r, c);
        calculateNumbers();
        startTimer();
        updateStatus("Game in progress...");
    }

    openCell(r, c);
    
    if (!isGameOver) {
        playSound('open');
        checkWin();
    }
}

function openCell(r, c) {
    const cellData = board[r][c];
    if (cellData.isOpen || cellData.isFlagged) return;

    cellData.isOpen = true;
    cellsOpened++;
    
    const cellEl = document.getElementById(`cell-${r}-${c}`);
    cellEl.classList.add('opened');

    if (cellData.isMine) {
        cellEl.classList.add('bg-danger');
        // Gunakan Lucide Bomb
        cellEl.innerHTML = `<span class="anim-pop text-white"><i data-lucide="bomb"></i></span>`;
        lucide.createIcons({ root: cellEl }); // Render icon SVG baru
        handleLose();
        return;
    }

    if (cellData.neighborMines > 0) {
        cellEl.innerHTML = `<span class="anim-pop n-${cellData.neighborMines}">${cellData.neighborMines}</span>`;
    } else {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                let nr = r + i, nc = c + j;
                if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) openCell(nr, nc);
            }
        }
    }
}

function toggleFlag(r, c) {
    if (isGameOver || board[r][c].isOpen || isFirstClick) return;

    const cellData = board[r][c];
    const cellEl = document.getElementById(`cell-${r}-${c}`);

    if (!cellData.isFlagged) {
        if (minesLeft > 0) {
            cellData.isFlagged = true;
            minesLeft--;
            cellEl.innerHTML = `<span class="anim-pop text-danger"><i data-lucide="flag"></i></span>`;
            lucide.createIcons({ root: cellEl });
            playSound('flag');
        }
    } else {
        cellData.isFlagged = false;
        minesLeft++;
        cellEl.innerHTML = '';
        playSound('flag');
    }
    updateCounter();
}

function checkWin() {
    if (cellsOpened === (config.rows * config.cols) - config.mines) {
        isGameOver = true;
        stopTimer();
        playSound('win');
        updateStatus("You Won! 🎉", "success");
        saveBestTime();
        showModal('win');
    }
}

function handleLose() {
    isGameOver = true;
    stopTimer();
    playSound('lose');
    updateStatus("Game Over! 💥", "danger");
    
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            const el = document.getElementById(`cell-${r}-${c}`);
            if (board[r][c].isMine && !board[r][c].isOpen && !board[r][c].isFlagged) {
                el.classList.add('opened');
                el.innerHTML = `<i data-lucide="bomb" class="text-dark"></i>`;
                lucide.createIcons({ root: el });
            }
            if (!board[r][c].isMine && board[r][c].isFlagged) {
                el.innerHTML = `<i data-lucide="x" class="text-danger"></i>`;
                lucide.createIcons({ root: el });
            }
        }
    }
    showModal('lose');
}

function startTimer() {
    stopTimer();
    timeElapsed = 0;
    updateTimerDisplay();
    timerInterval = setInterval(() => { timeElapsed++; updateTimerDisplay(); }, 1000);
}

function stopTimer() {
    if (timerInterval) clearInterval(timerInterval);
}

function updateTimerDisplay() {
    const m = String(Math.floor(timeElapsed / 60)).padStart(2, '0');
    const s = String(timeElapsed % 60).padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateCounter() {
    document.getElementById('mine-counter').innerText = minesLeft;
}

function updateStatus(text, type = "normal") {
    const badge = document.getElementById('game-status-badge');
    badge.innerText = text;
    badge.style.color = type === 'success' ? '#059669' : (type === 'danger' ? '#DC2626' : '#475569');
    badge.style.borderColor = type === 'success' ? '#A7F3D0' : (type === 'danger' ? '#FECACA' : 'var(--border)');
    badge.style.backgroundColor = type === 'success' ? '#F0FDF4' : (type === 'danger' ? '#FEF2F2' : 'var(--bg)');
}

function saveBestTime() {
    const key = `minesweeper_best_${currentDiffKey}`;
    const best = localStorage.getItem(key);
    if (!best || timeElapsed < parseInt(best)) {
        localStorage.setItem(key, timeElapsed);
        loadBestTime();
    }
}

function loadBestTime() {
    const key = `minesweeper_best_${currentDiffKey}`;
    const best = localStorage.getItem(key);
    document.getElementById('best-time').innerText = best ? formatTime(parseInt(best)) : '--:--';
}

function showModal(result) {
    const modal = document.getElementById('game-modal');
    const iconContainer = document.getElementById('modal-icon-container');
    const title = document.getElementById('modal-title');
    const desc = document.getElementById('modal-desc');
    
    document.getElementById('modal-time').innerText = formatTime(timeElapsed);
    document.getElementById('modal-diff').innerText = document.querySelector(`#difficulty-select option[value="${currentDiffKey}"]`).text.split(' ')[0];

    if (result === 'win') {
        iconContainer.className = 'modal-icon-container win';
        iconContainer.innerHTML = '<i data-lucide="trophy"></i>';
        title.innerText = 'Master Sweeper!';
        desc.innerText = 'You successfully cleared all the mines.';
    } else {
        iconContainer.className = 'modal-icon-container lose';
        iconContainer.innerHTML = '<i data-lucide="bomb"></i>';
        title.innerText = 'Mission Failed';
        desc.innerText = 'You hit a mine. Better luck next time!';
    }
    
    lucide.createIcons({ root: iconContainer });
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

function hideModal() {
    const modal = document.getElementById('game-modal');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
}

function initGame() {
    hideModal();
    stopTimer();
    currentDiffKey = document.getElementById('difficulty-select').value;
    config = DIFFICULTIES[currentDiffKey];
    isGameOver = false;
    isFirstClick = true;
    cellsOpened = 0;
    minesLeft = config.mines;
    timeElapsed = 0;
    
    updateCounter();
    updateTimerDisplay();
    updateStatus("Ready to play");
    loadBestTime();
    
    createBoardData();
    renderBoard();
    
    document.getElementById('start-overlay').classList.remove('hidden');
    
    // Inisialisasi ikon Lucide pada seluruh UI pertama kali
    lucide.createIcons();
}

function startGameSession() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('start-overlay').classList.add('hidden');
    updateStatus("Click anywhere to start...");
}

// Inisialisasi Event
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('restart-btn').addEventListener('click', initGame);
    document.getElementById('modal-btn').addEventListener('click', initGame);
    document.getElementById('difficulty-select').addEventListener('change', initGame);
    document.getElementById('btn-start-game').addEventListener('click', startGameSession);
    
    initGame();
});