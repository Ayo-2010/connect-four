'use strict';

const COLS = 7;
const ROWS = 6;
const TOTAL_CELLS = COLS * ROWS;
const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
];
const CENTER_ORDER = [3, 2, 4, 1, 5, 0, 6];

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const newGameBtn = document.getElementById('newGame');
const resetScoreBtn = document.getElementById('resetScore');
const modeCpuBtn = document.getElementById('modeCpu');
const modeFriendBtn = document.getElementById('modeFriend');
const scorePlayerEl = document.getElementById('scorePlayer');
const scoreCpuEl = document.getElementById('scoreCpu');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const overlayNote = document.getElementById('overlayNote');
const playAgainBtn = document.getElementById('playAgainBtn');
const playerLabel = document.getElementById('playerLabel');
const cpuLabel = document.getElementById('cpuLabel');
const bestStreakEl = document.getElementById('bestStreak');
const gameArea = document.querySelector('.game-area');
const turnBanner = document.querySelector('.turn-banner');
const guidesEl = document.querySelector('.column-guides');

let mode = 'cpu';
let boardData = Array(TOTAL_CELLS).fill(0);
let currentPlayer = 1;
let gameOver = false;
let aiThinking = false;
let aiTimer = 0;
let overlayTimer = 0;
let roundToken = 0;
let playerWins = 0;
let cpuWins = 0;
let currentStreak = 0;
let streakSide = 0;
let bestStreak = loadBestStreak();
let hoveredColumn = -1;

function loadBestStreak() {
  try {
    const stored = Number(localStorage.getItem('connectFour.bestStreak'));
    return Number.isFinite(stored) && stored > 0 ? Math.floor(stored) : 0;
  } catch (error) {
    return 0;
  }
}

function saveBestStreak() {
  try {
    localStorage.setItem('connectFour.bestStreak', String(bestStreak));
  } catch (error) {
    return;
  }
}

function loadMode() {
  try {
    const stored = localStorage.getItem('connectFour.mode');
    if (stored === 'friend' || stored === 'cpu') {
      mode = stored;
    }
  } catch (error) {
    mode = 'cpu';
  }
}

function saveMode() {
  try {
    localStorage.setItem('connectFour.mode', mode);
  } catch (error) {
    return;
  }
}

function indexFor(row, col) {
  return row * COLS + col;
}

function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}

function createBoard() {
  boardEl.innerHTML = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.index = String(indexFor(row, col));
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', 'Column ' + (col + 1) + ', row ' + (row + 1));
      boardEl.appendChild(cell);
    }
  }
}

function createGuides() {
  guidesEl.innerHTML = '';
  for (let col = 0; col < COLS; col += 1) {
    const guide = document.createElement('span');
    guide.className = 'guide';
    guide.dataset.col = String(col);
    guidesEl.appendChild(guide);
  }
}

function cellAt(row, col) {
  return boardEl.children[indexFor(row, col)];
}

function findDropRow(data, col) {
  for (let row = ROWS - 1; row >= 0; row -= 1) {
    if (data[indexFor(row, col)] === 0) {
      return row;
    }
  }
  return -1;
}

function findWinCells(data, row, col, player) {
  for (let d = 0; d < DIRECTIONS.length; d += 1) {
    const deltaRow = DIRECTIONS[d][0];
    const deltaCol = DIRECTIONS[d][1];
    const before = [];
    let checkRow = row - deltaRow;
    let checkCol = col - deltaCol;
    while (inBounds(checkRow, checkCol) && data[indexFor(checkRow, checkCol)] === player) {
      before.push(indexFor(checkRow, checkCol));
      checkRow -= deltaRow;
      checkCol -= deltaCol;
    }
    const after = [];
    checkRow = row + deltaRow;
    checkCol = col + deltaCol;
    while (inBounds(checkRow, checkCol) && data[indexFor(checkRow, checkCol)] === player) {
      after.push(indexFor(checkRow, checkCol));
      checkRow += deltaRow;
      checkCol += deltaCol;
    }
    if (before.length + 1 + after.length >= 4) {
      const line = before.reverse().concat([indexFor(row, col)], after);
      const currentIndex = before.length;
      const start = Math.min(Math.max(0, currentIndex - 3), line.length - 4);
      return line.slice(start, start + 4);
    }
  }
  return null;
}

function renderDisc(row, col, player) {
  const cell = cellAt(row, col);
  const disc = document.createElement('div');
  disc.className = 'disc ' + (player === 1 ? 'disc-red' : 'disc-yellow') + ' is-dropping';
  const fall = cell.offsetTop + cell.offsetHeight;
  disc.style.setProperty('--fall', fall + 'px');
  cell.appendChild(disc);
  cell.dataset.player = String(player);
  cell.setAttribute('aria-label', (player === 1 ? 'Red' : 'Yellow') + ' disc, column ' + (col + 1) + ', row ' + (row + 1));
  setTimeout(() => {
    disc.classList.remove('is-dropping');
  }, 380);
}

function sideName(player) {
  if (mode === 'cpu') {
    return player === 1 ? 'You' : 'Computer';
  }
  return 'Player ' + player;
}

function winnerTitle(player) {
  if (mode === 'cpu') {
    return player === 1 ? 'You win!' : 'Computer wins';
  }
  return player === 1 ? 'Player 1 wins!' : 'Player 2 wins!';
}

function updateScores() {
  scorePlayerEl.textContent = String(playerWins);
  scoreCpuEl.textContent = String(cpuWins);
  bestStreakEl.textContent = String(bestStreak);
}

function updateLabels() {
  playerLabel.textContent = mode === 'cpu' ? 'You' : 'Player 1';
  cpuLabel.textContent = mode === 'cpu' ? 'Computer' : 'Player 2';
}

function updateTurn() {
  turnBanner.dataset.turn = String(currentPlayer);
  gameArea.classList.toggle('turn-yellow', currentPlayer === 2);
  if (mode === 'cpu' && currentPlayer === 2) {
    statusEl.textContent = 'Computer is thinking';
  } else if (mode === 'cpu') {
    statusEl.textContent = 'Your turn';
  } else {
    statusEl.textContent = 'Player ' + currentPlayer + "'s turn";
  }
}

function updateModeButtons() {
  const cpuActive = mode === 'cpu';
  modeCpuBtn.classList.toggle('is-active', cpuActive);
  modeFriendBtn.classList.toggle('is-active', !cpuActive);
  modeCpuBtn.setAttribute('aria-pressed', String(cpuActive));
  modeFriendBtn.setAttribute('aria-pressed', String(!cpuActive));
}

function setHoverColumn(col) {
  if (gameOver || (mode === 'cpu' && currentPlayer === 2)) {
    col = -1;
  }
  if (col >= 0 && findDropRow(boardData, col) < 0) {
    col = -1;
  }
  if (col === hoveredColumn) {
    return;
  }
  hoveredColumn = col;
  for (let i = 0; i < boardEl.children.length; i += 1) {
    const cell = boardEl.children[i];
    cell.classList.toggle('is-hover', Number(cell.dataset.col) === col);
  }
  for (let i = 0; i < guidesEl.children.length; i += 1) {
    guidesEl.children[i].classList.toggle('is-active', Number(guidesEl.children[i].dataset.col) === col);
  }
}

function chooseWinningColumn(data, player) {
  for (let i = 0; i < CENTER_ORDER.length; i += 1) {
    const col = CENTER_ORDER[i];
    const row = findDropRow(data, col);
    if (row < 0) {
      continue;
    }
    const index = indexFor(row, col);
    data[index] = player;
    const win = findWinCells(data, row, col, player);
    data[index] = 0;
    if (win) {
      return col;
    }
  }
  return -1;
}

function chooseAiMove() {
  const winning = chooseWinningColumn(boardData, 2);
  if (winning >= 0) {
    return winning;
  }
  const blocking = chooseWinningColumn(boardData, 1);
  if (blocking >= 0) {
    return blocking;
  }
  for (let i = 0; i < CENTER_ORDER.length; i += 1) {
    if (findDropRow(boardData, CENTER_ORDER[i]) >= 0) {
      return CENTER_ORDER[i];
    }
  }
  return -1;
}

function queueAiMove() {
  if (mode !== 'cpu' || gameOver || currentPlayer !== 2) {
    return;
  }
  aiThinking = true;
  boardEl.classList.add('is-thinking');
  setHoverColumn(-1);
  statusEl.textContent = 'Computer is thinking';
  const token = roundToken;
  aiTimer = setTimeout(() => {
    if (token !== roundToken || gameOver || currentPlayer !== 2) {
      aiThinking = false;
      boardEl.classList.remove('is-thinking');
      return;
    }
    const col = chooseAiMove();
    aiThinking = false;
    boardEl.classList.remove('is-thinking');
    if (col >= 0) {
      dropInColumn(col);
    }
  }, 430 + Math.random() * 220);
}

function showOverlay(title, note) {
  overlayText.textContent = title;
  overlayNote.textContent = note;
  overlay.hidden = false;
  playAgainBtn.focus();
}

function finishWin(winner, cells) {
  gameOver = true;
  aiThinking = false;
  boardEl.classList.remove('is-thinking');
  clearTimeout(aiTimer);
  setHoverColumn(-1);
  if (winner === 1) {
    playerWins += 1;
  } else {
    cpuWins += 1;
  }
  if (streakSide === winner) {
    currentStreak += 1;
  } else {
    streakSide = winner;
    currentStreak = 1;
  }
  if (currentStreak > bestStreak) {
    bestStreak = currentStreak;
    saveBestStreak();
  }
  updateScores();
  turnBanner.dataset.turn = String(winner);
  gameArea.classList.toggle('turn-yellow', winner === 2);
  statusEl.textContent = winnerTitle(winner).replace('!', '');
  const token = roundToken;
  setTimeout(() => {
    if (token !== roundToken) {
      return;
    }
    for (let i = 0; i < cells.length; i += 1) {
      const disc = boardEl.children[cells[i]].querySelector('.disc');
      if (disc) {
        disc.classList.add('is-win');
      }
    }
  }, 320);
  overlayTimer = setTimeout(() => {
    if (token === roundToken) {
      showOverlay(winnerTitle(winner), 'Four in a row · ' + playerWins + ' — ' + cpuWins);
    }
  }, 680);
}

function finishDraw() {
  gameOver = true;
  aiThinking = false;
  currentStreak = 0;
  streakSide = 0;
  boardEl.classList.remove('is-thinking');
  clearTimeout(aiTimer);
  setHoverColumn(-1);
  statusEl.textContent = "It's a draw";
  const token = roundToken;
  overlayTimer = setTimeout(() => {
    if (token === roundToken) {
      showOverlay('A draw', 'The board is full. Nobody cracked it.');
    }
  }, 420);
}

function dropInColumn(col) {
  if (gameOver || aiThinking || col < 0 || col >= COLS) {
    return;
  }
  if (mode === 'cpu' && currentPlayer === 2) {
    return;
  }
  const row = findDropRow(boardData, col);
  if (row < 0) {
    return;
  }
  const index = indexFor(row, col);
  boardData[index] = currentPlayer;
  renderDisc(row, col, currentPlayer);
  setHoverColumn(-1);
  const win = findWinCells(boardData, row, col, currentPlayer);
  if (win) {
    finishWin(currentPlayer, win);
    return;
  }
  if (boardData.every((value) => value !== 0)) {
    finishDraw();
    return;
  }
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateTurn();
  if (mode === 'cpu' && currentPlayer === 2) {
    queueAiMove();
  }
}

function newGame() {
  roundToken += 1;
  clearTimeout(aiTimer);
  clearTimeout(overlayTimer);
  aiThinking = false;
  gameOver = false;
  currentPlayer = 1;
  boardData = Array(TOTAL_CELLS).fill(0);
  overlay.hidden = true;
  boardEl.classList.remove('is-thinking');
  const discs = boardEl.querySelectorAll('.disc');
  for (let i = 0; i < discs.length; i += 1) {
    discs[i].remove();
  }
  for (let i = 0; i < boardEl.children.length; i += 1) {
    const cell = boardEl.children[i];
    cell.classList.remove('is-win', 'is-hover');
    delete cell.dataset.player;
    const col = Number(cell.dataset.col);
    const row = Number(cell.dataset.row);
    cell.setAttribute('aria-label', 'Column ' + (col + 1) + ', row ' + (row + 1));
  }
  setHoverColumn(-1);
  updateTurn();
}

function setMode(nextMode) {
  mode = nextMode === 'friend' ? 'friend' : 'cpu';
  saveMode();
  updateModeButtons();
  updateLabels();
  newGame();
}

newGameBtn.addEventListener('click', newGame);
playAgainBtn.addEventListener('click', newGame);
resetScoreBtn.addEventListener('click', () => {
  playerWins = 0;
  cpuWins = 0;
  currentStreak = 0;
  streakSide = 0;
  updateScores();
});

modeCpuBtn.addEventListener('click', () => {
  setMode('cpu');
});

modeFriendBtn.addEventListener('click', () => {
  setMode('friend');
});

boardEl.addEventListener('pointerover', (event) => {
  const cell = event.target.closest('.cell');
  if (cell) {
    setHoverColumn(Number(cell.dataset.col));
  }
});

boardEl.addEventListener('pointerleave', () => {
  setHoverColumn(-1);
});

boardEl.addEventListener('click', (event) => {
  const cell = event.target.closest('.cell');
  if (cell) {
    dropInColumn(Number(cell.dataset.col));
  }
});

guidesEl.addEventListener('pointerover', (event) => {
  const guide = event.target.closest('.guide');
  if (guide) {
    setHoverColumn(Number(guide.dataset.col));
  }
});

guidesEl.addEventListener('pointerleave', () => {
  setHoverColumn(-1);
});

guidesEl.addEventListener('click', (event) => {
  const guide = event.target.closest('.guide');
  if (guide) {
    dropInColumn(Number(guide.dataset.col));
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key >= '1' && event.key <= '7') {
    event.preventDefault();
    if (!gameOver) {
      dropInColumn(Number(event.key) - 1);
    }
  } else if (event.code === 'KeyN') {
    event.preventDefault();
    newGame();
  }
});

loadMode();
createBoard();
createGuides();
updateModeButtons();
updateLabels();
updateScores();
newGame();
