const GRID_MIN = -5;
const GRID_MAX = 5;
const GRID_SIZE = GRID_MAX - GRID_MIN + 1;
const HERO_START = { x: 0, y: 0 };
const PLAYFIELD_BOUNDS = {
  left: 12.57,
  right: 12.67,
  top: 30.05,
  bottom: 12.27,
};

const levels = [
  { title: 'Уровень 1', finish: { x: 2, y: 1 } },
  { title: 'Уровень 2', finish: { x: -3, y: 4 } },
  { title: 'Уровень 3', finish: { x: 4, y: -2 } },
  { title: 'Уровень 4', finish: { x: -1, y: -5 } },
  { title: 'Уровень 5', finish: { x: 5, y: 5 } },
  { title: 'Уровень 6', finish: { x: -4, y: -1 } },
  { title: 'Уровень 7', finish: { x: 1, y: -4 } },
  { title: 'Уровень 8', finish: { x: -2, y: 2 } },
  { title: 'Уровень 9', finish: { x: 3, y: 0 } },
  { title: 'Уровень 10', finish: { x: 0, y: 5 } },
];

const board = document.getElementById('board');
const levelTitle = document.getElementById('level-title');
const levelProgress = document.getElementById('level-progress');
const workspaceContainer = document.getElementById('blockly-workspace');
const runButton = document.getElementById('run-program');
const levelSelect = document.getElementById('level-select');
const levelCompleteModal = document.getElementById('level-complete-modal');
const levelCompleteTitle = document.getElementById('level-complete-title');
const levelCompleteMessage = document.getElementById('level-complete-message');
const nextLevelButton = document.getElementById('next-level-button');
const retryLevelButton = document.getElementById('retry-level-button');

let workspace;
let currentLevelIndex = 0;
let highestUnlockedLevel = 0;
let isProgramRunning = false;
let currentHeroPosition = { ...HERO_START };
const progressStorageKey = 'maze-highest-unlocked-level';

const defineBlocksWithJsonArray = Blockly.common?.defineBlocksWithJsonArray
  ?? Blockly.defineBlocksWithJsonArray;

defineBlocksWithJsonArray([
  {
    type: 'maze_start',
    message0: 'Запуск',
    nextStatement: null,
    colour: 45,
    deletable: false,
    movable: false,
    hat: 'cap',
    tooltip: 'Точка входа в программу',
  },
  {
    type: 'maze_go_to',
    message0: 'Перейти в x %1 y %2',
    args0: [
      {
        type: 'field_number',
        name: 'X',
        value: 0,
        min: GRID_MIN,
        max: GRID_MAX,
        precision: 1,
      },
      {
        type: 'field_number',
        name: 'Y',
        value: 0,
        min: GRID_MIN,
        max: GRID_MAX,
        precision: 1,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: 340,
    tooltip: 'Перемещает героя в указанную координату.',
  },
]);

function getCurrentLevel() {
  return levels[currentLevelIndex];
}

function renderLevelOptions() {
  if (!levelSelect) return;

  levelSelect.innerHTML = levels.map((level, index) => {
    const isLocked = index > highestUnlockedLevel;
    const selected = index === currentLevelIndex ? 'selected' : '';
    const disabled = isLocked ? 'disabled' : '';
    const suffix = isLocked ? ' 🔒' : '';
    return `<option value="${index}" ${selected} ${disabled}>${level.title}${suffix}</option>`;
  }).join('');
}

function saveProgress() {
  try {
    window.localStorage.setItem(progressStorageKey, String(highestUnlockedLevel));
  } catch (error) {
    console.warn('Не удалось сохранить прогресс уровней.', error);
  }
}

function loadProgress() {
  try {
    const storedValue = window.localStorage.getItem(progressStorageKey);
    const parsedValue = Number.parseInt(storedValue ?? '', 10);

    if (Number.isNaN(parsedValue)) {
      highestUnlockedLevel = 0;
      return;
    }

    highestUnlockedLevel = Math.min(Math.max(parsedValue, 0), levels.length - 1);
  } catch (error) {
    highestUnlockedLevel = 0;
    console.warn('Не удалось загрузить сохраненный прогресс уровней.', error);
  }
}

function coordinateToPercent(x, y) {
  const col = x - GRID_MIN;
  const row = GRID_MAX - y;
  const step = 100 / (GRID_SIZE - 1);

  return {
    left: col * step,
    top: row * step,
  };
}

function projectToBoardPercent(x, y) {
  const coord = coordinateToPercent(x, y);
  const width = 100 - PLAYFIELD_BOUNDS.left - PLAYFIELD_BOUNDS.right;
  const height = 100 - PLAYFIELD_BOUNDS.top - PLAYFIELD_BOUNDS.bottom;

  return {
    left: PLAYFIELD_BOUNDS.left + (coord.left / 100) * width,
    top: PLAYFIELD_BOUNDS.top + (coord.top / 100) * height,
  };
}

function createCoordinateLabels() {
  const labelsLayer = document.createElement('div');
  labelsLayer.className = 'coordinate-labels';

  for (let x = GRID_MIN; x <= GRID_MAX; x += 1) {
    const projected = projectToBoardPercent(x, 0);
    const xLabel = document.createElement('span');
    xLabel.className = 'coord-label x-label';
    xLabel.textContent = String(x);
    xLabel.style.left = `${projected.left}%`;
    xLabel.style.top = `${projected.top}%`;
    labelsLayer.appendChild(xLabel);
  }

  for (let y = GRID_MIN; y <= GRID_MAX; y += 1) {
    const projected = projectToBoardPercent(0, y);
    const yLabel = document.createElement('span');
    yLabel.className = 'coord-label y-label';
    yLabel.textContent = String(y);
    yLabel.style.left = `${projected.left}%`;
    yLabel.style.top = `${projected.top}%`;
    labelsLayer.appendChild(yLabel);
  }

  const xAxisName = document.createElement('span');
  xAxisName.className = 'axis-name axis-name-x';
  xAxisName.textContent = 'X';
  xAxisName.style.left = `calc(${projectToBoardPercent(GRID_MAX, 0).left}% + 2.2cqw)`;
  xAxisName.style.top = `${projectToBoardPercent(0, 0).top}%`;
  labelsLayer.appendChild(xAxisName);

  const yAxisName = document.createElement('span');
  yAxisName.className = 'axis-name axis-name-y';
  yAxisName.textContent = 'Y';
  yAxisName.style.left = `${projectToBoardPercent(0, 0).left}%`;
  yAxisName.style.top = `calc(${projectToBoardPercent(0, GRID_MAX).top}% - 2.4cqw)`;
  labelsLayer.appendChild(yAxisName);

  return labelsLayer;
}

function createFinishPoint() {
  const finish = document.createElement('div');
  finish.className = 'finish-point';
  const { x, y } = getCurrentLevel().finish;
  const pos = coordinateToPercent(x, y);
  finish.style.left = `${pos.left}%`;
  finish.style.top = `${pos.top}%`;
  return finish;
}

function createHero() {
  const hero = document.createElement('div');
  hero.className = 'hero';
  const pos = coordinateToPercent(currentHeroPosition.x, currentHeroPosition.y);
  hero.style.left = `${pos.left}%`;
  hero.style.top = `${pos.top}%`;
  return hero;
}

function renderBoard() {
  const level = getCurrentLevel();
  board.innerHTML = '';

  const background = document.createElement('div');
  background.className = 'board-background';
  background.style.backgroundImage = "url('./lvl.svg')";
  board.appendChild(background);

  const playfield = document.createElement('div');
  playfield.className = 'board-playfield';
  board.appendChild(createCoordinateLabels());
  playfield.appendChild(createFinishPoint());
  playfield.appendChild(createHero());
  board.appendChild(playfield);

  levelTitle.textContent = level.title;
  levelProgress.textContent = `Открыто уровней: ${highestUnlockedLevel + 1} из ${levels.length}`;
  renderLevelOptions();
}

function resetWorkspace() {
  workspace.clear();
  const startBlock = workspace.newBlock('maze_start');
  startBlock.initSvg();
  startBlock.render();
  startBlock.moveBy(36, 36);

  const goToBlock = workspace.newBlock('maze_go_to');
  goToBlock.initSvg();
  goToBlock.render();
  goToBlock.moveBy(36, 120);
  startBlock.nextConnection.connect(goToBlock.previousConnection);

  startBlock.select();
  workspace.centerOnBlock(startBlock.id);
  Blockly.svgResize(workspace);
}

function initializeBlockly() {
  if (!Blockly || !workspaceContainer) {
    console.error('Blockly не инициализирован: проверь загрузку библиотеки и контейнер workspace.');
    return;
  }

  workspace = Blockly.inject(workspaceContainer, {
    toolbox: {
      kind: 'flyoutToolbox',
      contents: [
        {
          kind: 'block',
          type: 'maze_go_to',
        },
      ],
    },
    toolboxPosition: 'start',
    horizontalLayout: false,
    trashcan: true,
    renderer: 'zelos',
    grid: {
      spacing: 24,
      length: 3,
      colour: 'rgba(124, 140, 255, 0.18)',
      snap: true,
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.95,
      maxScale: 1.4,
      minScale: 0.7,
      scaleSpeed: 1.1,
    },
    move: {
      scrollbars: true,
      drag: true,
      wheel: true,
    },
  });

  resetWorkspace();
  requestAnimationFrame(() => {
    Blockly.svgResize(workspace);
    workspace.scrollCenter();
  });
  window.addEventListener('resize', () => Blockly.svgResize(workspace));
}

function hideLevelCompleteModal() {
  levelCompleteModal?.classList.add('hidden');
}

function showLevelCompleteModal(message, canProceed = true, options = {}) {
  if (!levelCompleteModal || !levelCompleteMessage) return;
  const { showRetry = false, hideTitle = false, title = 'Молодец!' } = options;
  if (levelCompleteTitle) {
    levelCompleteTitle.hidden = hideTitle;
    levelCompleteTitle.textContent = title;
  }
  levelCompleteMessage.textContent = message;
  const hasNextLevel = canProceed && currentLevelIndex < levels.length - 1;
  if (nextLevelButton) {
    nextLevelButton.hidden = !hasNextLevel;
    nextLevelButton.disabled = !hasNextLevel;
  }
  if (retryLevelButton) {
    retryLevelButton.hidden = !showRetry;
  }
  levelCompleteModal.classList.remove('hidden');
}

function setLevel(index) {
  if (index < 0 || index > highestUnlockedLevel || index >= levels.length) return;
  currentLevelIndex = index;
  currentHeroPosition = { ...HERO_START };
  hideLevelCompleteModal();
  resetWorkspace();
  renderBoard();
}

function getGoToCommand() {
  const startBlock = workspace.getBlocksByType('maze_start', false)[0];
  if (!startBlock) return null;
  let currentBlock = startBlock.getNextBlock();

  while (currentBlock) {
    if (currentBlock.type === 'maze_go_to') {
      return {
        x: Number(currentBlock.getFieldValue('X')),
        y: Number(currentBlock.getFieldValue('Y')),
      };
    }
    currentBlock = currentBlock.getNextBlock();
  }

  return null;
}

function handleLevelCompleted() {
  highestUnlockedLevel = Math.max(highestUnlockedLevel, Math.min(currentLevelIndex + 1, levels.length - 1));
  saveProgress();
  renderLevelOptions();

  const message = currentLevelIndex === levels.length - 1
    ? 'Отлично! Ты прошёл все уровни!'
    : `Верно! Координаты финиша найдены. ${levels[currentLevelIndex + 1].title} разблокирован.`;
  showLevelCompleteModal(message, true);
}

async function runProgram() {
  if (isProgramRunning) return;

  const command = getGoToCommand();
  if (!command) {
    showLevelCompleteModal('Добавь блок «Перейти в x, y» и укажи координаты.', false, { showRetry: true, hideTitle: true });
    return;
  }

  isProgramRunning = true;
  runButton.disabled = true;
  currentHeroPosition = { ...HERO_START };
  renderBoard();

  try {
    await new Promise((resolve) => setTimeout(resolve, 400));
    currentHeroPosition = { ...command };
    renderBoard();

    const finish = getCurrentLevel().finish;
    const isCorrect = command.x === finish.x && command.y === finish.y;

    if (isCorrect) {
      handleLevelCompleted();
      return;
    }

    showLevelCompleteModal(
      `Пока неверно. Ты отправил героя в (${command.x}, ${command.y}), а финиш находится в другой точке.`,
      false,
      { showRetry: true, hideTitle: true },
    );
  } finally {
    isProgramRunning = false;
    runButton.disabled = false;
  }
}

if (runButton) {
  runButton.addEventListener('click', () => {
    runProgram();
  });
}

if (levelSelect) {
  levelSelect.addEventListener('change', (event) => {
    setLevel(Number(event.target.value));
  });
}

if (nextLevelButton) {
  nextLevelButton.addEventListener('click', () => {
    const nextLevelIndex = Math.min(currentLevelIndex + 1, highestUnlockedLevel);
    if (nextLevelIndex !== currentLevelIndex) {
      setLevel(nextLevelIndex);
      return;
    }
    hideLevelCompleteModal();
  });
}

if (retryLevelButton) {
  retryLevelButton.addEventListener('click', () => {
    hideLevelCompleteModal();
    currentHeroPosition = { ...HERO_START };
    renderBoard();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideLevelCompleteModal();
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) runProgram();
});

loadProgress();
initializeBlockly();
renderLevelOptions();
setLevel(0);
