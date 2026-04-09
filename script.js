const DEFAULT_GRID = { min: -5, max: 5, step: 1 };
const ADVANCED_GRID = { min: -150, max: 150, step: 30 };
const HERO_START = { x: 0, y: 0 };
const PLAYFIELD_BOUNDS = {
  left: 12.57,
  right: 12.67,
  top: 21.67,
  bottom: 13.74,
};

const levels = [
  { title: 'Уровень 1', finish: { x: 2, y: 1 } },
  { title: 'Уровень 2', finish: { x: -3, y: 4 } },
  { title: 'Уровень 3', finish: { x: 4, y: -2 } },
  { title: 'Уровень 4', finishes: [{ x: -4, y: -1 }, { x: 1, y: 3 }] },
  { title: 'Уровень 5', finishes: [{ x: 3, y: 0 }, { x: -2, y: 4 }, { x: 4, y: -3 }] },
  { title: 'Уровень 6', finishes: [{ x: 0, y: 4 }, { x: -4, y: -2 }, { x: 2, y: 1 }] },
  { title: 'Уровень 7', finish: { x: 30, y: 60 } },
  { title: 'Уровень 8', finish: { x: 60, y: 90 } },
  { title: 'Уровень 9', finishes: [{ x: 90, y: 120 }, { x: -30, y: 60 }] },
  { title: 'Уровень 10', finishes: [{ x: 120, y: 120 }, { x: 60, y: -30 }, { x: -90, y: 90 }] },
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
        min: DEFAULT_GRID.min,
        max: DEFAULT_GRID.max,
        precision: DEFAULT_GRID.step,
      },
      {
        type: 'field_number',
        name: 'Y',
        value: 0,
        min: DEFAULT_GRID.min,
        max: DEFAULT_GRID.max,
        precision: DEFAULT_GRID.step,
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

function getCurrentGrid() {
  return currentLevelIndex >= 6 ? ADVANCED_GRID : DEFAULT_GRID;
}

function getLevelStartPosition() {
  const grid = getCurrentGrid();
  const hasZeroPoint = grid.min <= 0 && grid.max >= 0;

  if (hasZeroPoint) {
    return { ...HERO_START };
  }

  return { x: grid.min, y: grid.min };
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
  const grid = getCurrentGrid();
  const gridSize = ((grid.max - grid.min) / grid.step) + 1;
  const col = (x - grid.min) / grid.step;
  const row = (grid.max - y) / grid.step;
  const step = 100 / (gridSize - 1);

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
  const grid = getCurrentGrid();
  const axisReference = grid.min <= 0 && grid.max >= 0 ? 0 : grid.min;

  for (let x = grid.min; x <= grid.max; x += grid.step) {
    const projected = projectToBoardPercent(x, axisReference);
    const xLabel = document.createElement('span');
    xLabel.className = 'coord-label x-label';
    xLabel.textContent = String(x);
    xLabel.style.left = `${projected.left}%`;
    xLabel.style.top = `${projected.top}%`;
    labelsLayer.appendChild(xLabel);
  }

  for (let y = grid.min; y <= grid.max; y += grid.step) {
    const projected = projectToBoardPercent(axisReference, y);
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
  xAxisName.style.left = `calc(${projectToBoardPercent(grid.max, axisReference).left}% + 2.2cqw)`;
  xAxisName.style.top = `${projectToBoardPercent(axisReference, axisReference).top}%`;
  labelsLayer.appendChild(xAxisName);

  const yAxisName = document.createElement('span');
  yAxisName.className = 'axis-name axis-name-y';
  yAxisName.textContent = 'Y';
  yAxisName.style.left = `${projectToBoardPercent(axisReference, axisReference).left}%`;
  yAxisName.style.top = `calc(${projectToBoardPercent(axisReference, grid.max).top}% - 2.4cqw)`;
  labelsLayer.appendChild(yAxisName);

  return labelsLayer;
}

function applyGridConstraintsToBlocks() {
  if (!workspace) return;
  const grid = getCurrentGrid();
  const goToBlocks = workspace.getBlocksByType('maze_go_to', false);

  for (const block of goToBlocks) {
    const xField = block.getField('X');
    const yField = block.getField('Y');
    xField?.setConstraints(grid.min, grid.max, grid.step);
    yField?.setConstraints(grid.min, grid.max, grid.step);
  }
}

function getLevelFinishes(level = getCurrentLevel()) {
  if (Array.isArray(level.finishes) && level.finishes.length > 0) {
    return level.finishes;
  }
  return [level.finish];
}

function createFinishPoints() {
  const finishes = getLevelFinishes();
  return finishes.map(({ x, y }) => {
    const finish = document.createElement('div');
    finish.className = 'finish-point';
    const pos = projectToBoardPercent(x, y);
    finish.style.left = `${pos.left}%`;
    finish.style.top = `${pos.top}%`;
    return finish;
  });
}

function createHero() {
  const hero = document.createElement('div');
  hero.className = 'hero';
  const pos = projectToBoardPercent(currentHeroPosition.x, currentHeroPosition.y);
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
  board.appendChild(playfield);

  const entitiesLayer = document.createElement('div');
  entitiesLayer.className = 'board-entities';
  for (const finishPoint of createFinishPoints()) {
    entitiesLayer.appendChild(finishPoint);
  }
  entitiesLayer.appendChild(createHero());
  board.appendChild(entitiesLayer);

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
  applyGridConstraintsToBlocks();

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
  workspace.addChangeListener(() => {
    applyGridConstraintsToBlocks();
  });
}

function hideLevelCompleteModal() {
  levelCompleteModal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
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
  document.body.classList.add('modal-open');
}

function setLevel(index) {
  if (index < 0 || index > highestUnlockedLevel || index >= levels.length) return;
  currentLevelIndex = index;
  currentHeroPosition = getLevelStartPosition();
  hideLevelCompleteModal();
  resetWorkspace();
  renderBoard();
}

function getGoToCommands() {
  const startBlock = workspace.getBlocksByType('maze_start', false)[0];
  if (!startBlock) return [];
  let currentBlock = startBlock.getNextBlock();
  const commands = [];

  while (currentBlock) {
    if (currentBlock.type === 'maze_go_to') {
      commands.push({
        x: Number(currentBlock.getFieldValue('X')),
        y: Number(currentBlock.getFieldValue('Y')),
      });
    }
    currentBlock = currentBlock.getNextBlock();
  }

  return commands;
}


function animateHeroTo(targetPosition) {
  const heroElement = board.querySelector('.hero');
  if (!heroElement) {
    currentHeroPosition = { ...targetPosition };
    renderBoard();
    return Promise.resolve();
  }

  const startPosition = { ...currentHeroPosition };
  const deltaX = targetPosition.x - startPosition.x;
  const deltaY = targetPosition.y - startPosition.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance === 0) {
    currentHeroPosition = { ...targetPosition };
    return Promise.resolve();
  }

  const baseDurationMs = 180;
  const perCellMs = 110;
  const maxDurationMs = 1200;
  const durationMs = Math.min(maxDurationMs, Math.round(baseDurationMs + distance * perCellMs));

  return new Promise((resolve) => {
    let isSettled = false;
    const finish = () => {
      if (isSettled) return;
      isSettled = true;
      heroElement.removeEventListener('transitionend', onTransitionEnd);
      clearTimeout(fallbackTimer);
      currentHeroPosition = { ...targetPosition };
      resolve();
    };

    const onTransitionEnd = (event) => {
      if (event.target !== heroElement) return;
      if (event.propertyName !== 'left' && event.propertyName !== 'top') return;
      finish();
    };

    const fallbackTimer = window.setTimeout(finish, durationMs + 90);
    const projected = projectToBoardPercent(targetPosition.x, targetPosition.y);

    heroElement.addEventListener('transitionend', onTransitionEnd);
    heroElement.style.transitionDuration = `${durationMs}ms`;

    requestAnimationFrame(() => {
      heroElement.style.left = `${projected.left}%`;
      heroElement.style.top = `${projected.top}%`;
    });
  });
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

  const commands = getGoToCommands();
  if (commands.length === 0) {
    showLevelCompleteModal('Добавь хотя бы один блок «Перейти в x, y» и укажи координаты.', false, { showRetry: true, hideTitle: true });
    return;
  }

  const grid = getCurrentGrid();
  for (const command of commands) {
    const hasInvalidStep = ((command.x - grid.min) % grid.step !== 0) || ((command.y - grid.min) % grid.step !== 0);
    const isOutOfRange = command.x < grid.min || command.x > grid.max || command.y < grid.min || command.y > grid.max;
    if (hasInvalidStep || isOutOfRange) {
      showLevelCompleteModal(
        `Для ${getCurrentLevel().title} используй шаг ${grid.step}. Допустимые координаты: от ${grid.min} до ${grid.max}.`,
        false,
        { showRetry: true, hideTitle: true },
      );
      return;
    }
  }

  isProgramRunning = true;
  runButton.disabled = true;
  currentHeroPosition = getLevelStartPosition();
  renderBoard();

  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const visitedFinishes = new Set();
    const finishPoints = getLevelFinishes();

    for (const command of commands) {
      await animateHeroTo(command);
      const reachedIndex = finishPoints.findIndex((finish) => finish.x === command.x && finish.y === command.y);
      if (reachedIndex >= 0) {
        visitedFinishes.add(reachedIndex);
      }
    }

    const isCorrect = visitedFinishes.size === finishPoints.length;

    if (isCorrect) {
      handleLevelCompleted();
      return;
    }

    const lastCommand = commands[commands.length - 1];
    showLevelCompleteModal(
      `Пока неверно. Ты посетил ${visitedFinishes.size} из ${finishPoints.length} финишных точек.`,
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
    currentHeroPosition = getLevelStartPosition();
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
