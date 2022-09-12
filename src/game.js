/** @type {HTMLCanvasElement} */
const canvasEl = dom('game');

/** @type {CanvasRenderingContext2D} */
const ctx = canvasEl.getContext('2d');

const TARGET_ENTITY_SPAWN_PADDING = 20;
const TARGET_ENTITY_RADIUS = 30;
const TARGET_ENTITY_START_TTD = 30;
const TARGET_ENTITY_MAX_TTD = 10;
const TARGET_ENTITY_TDD_DIFF_PER_UPDATE = 0.05;
const TARGET_ENTITY_SPRITE_PADDING = 16;

const GAME_LIVES_AT_START = 5;

/**
 * @readonly
 * @enum {string}
 */
const GameStatus = {
  NewGame: 'NewGame',
  Playing: 'Playing',
  Paused: 'Paused',
  GameOver: 'GameOver',
};

const gameConfig = {
  // Loop configs
  fps: 10,
  fpsInterval: 1000 / 10, // TODO: 1000 / fps
  then: Date.now(),

  // Game variables
  // Size will be derived from element at the start
  width: null,
  height: null,

  // Game status
  /** @type {GameStatus} */
  status: GameStatus.NewGame,
  paused: function () {
    return (
      this.status === GameStatus.Paused ||
      this.status === GameStatus.NewGame ||
      this.status === GameStatus.GameOver
    );
  },
};

// ============================================================================
// Target entity controller

class TargetEntity {
  /**
   * Base Target Entity
   * @param {number} x x-coordinate
   * @param {number} y y-coordinate
   * @param {number} r radius
   * @param {number} ttd ticks to die in
   */
  constructor(x, y, r, ttd) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.dr = 0;
    this.r2 = r ** 2;
    this.ttd = ttd;
  }

  /**
   * Returns Target Entity at random co-ordinates
   * @param {number} ttd Time To Die
   * @returns {TargetEntity}
   */
  static random(tdd = TARGET_ENTITY_START_TTD) {
    const r = TARGET_ENTITY_RADIUS + TARGET_ENTITY_SPAWN_PADDING;
    return new TargetEntity(
      randomNumber(r, gameConfig.width - r),
      randomNumber(r, gameConfig.height - r),
      TARGET_ENTITY_RADIUS,
      tdd
    );
  }

  update() {
    this.ttd -= 1;
    this.ttd <= 0 && console.info('[Target Entity] expired');
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
    ctx.fill();

    ctx.drawImage(
      dom('img-fp'),
      this.x - this.r - TARGET_ENTITY_SPRITE_PADDING,
      this.y - this.r - TARGET_ENTITY_SPRITE_PADDING,
      this.r * 2 + 2 * TARGET_ENTITY_SPRITE_PADDING,
      this.r * 2 + 2 * TARGET_ENTITY_SPRITE_PADDING
    );
  }

  /**
   * Returns true if the entity can collide with given coordinate
   * @param {{x: number, y: number}} coordinate
   * @returns {boolean}
   */
  canCollideWith({ x, y }) {
    return (this.x - x) ** 2 + (this.y - y) ** 2 < this.r2;
  }
}

/**
 * Controls Target Entities.
 * @class
 * @private
 */
class TargetEntityController {
  /**
   * Targets to control
   * @type {TargetEntity[]}
   * @private
   */
  targets = [];

  /**
   * Maximum number of targets that can live at a time
   * Default is 1
   * @type {number}
   * @private
   */
  targetsLimit = 1;

  /**
   * Shoot at this coordinates at next update
   * This should be most recent left clicks
   *
   * @type {{x: number, y: number} | undefined}
   * @public
   */
  shootAt = undefined;

  /**
   * Internal current max tdd.
   * @type {number}
   * @private
   */
  _currentMaxTdd = TARGET_ENTITY_START_TTD;
  get currentMaxTdd() {
    return Math.max(Math.floor(this._currentMaxTdd), TARGET_ENTITY_MAX_TTD);
  }

  update() {
    // Update existing targets
    let numberOfHits = 0;
    this.targets.forEach((entity) => {
      // Check whether user shot any entity
      if (this.shootAt && entity.canCollideWith(this.shootAt)) {
        gameManager.didHit();
        numberOfHits += 1;
        // Immediatly shoot the entity
        entity.ttd = -1; // -1 cause 0 means natural death
      }

      entity.update();
    });

    // If user shot but there were no hits it was a miss
    const didShotMissedTarget = this.shootAt && numberOfHits === 0;
    const didTargetExpired = this.targets.some((entity) => entity.ttd === 0);
    if (didShotMissedTarget || didTargetExpired) {
      gameManager.didMiss();
    }

    // Remove the targets which are dead
    this.targets = this.targets.filter((entity) => entity.ttd > 0);

    // Generate new target if needed
    if (this.targets.length < this.targetsLimit) {
      this.generateNewTarget();
    }

    // Clear the previous shot
    this.shootAt = undefined;

    // Reduce tdd for next Target
    this._currentMaxTdd -= TARGET_ENTITY_TDD_DIFF_PER_UPDATE;
  }

  draw() {
    this.targets.forEach((entity) => entity.draw());
  }

  generateNewTarget() {
    console.assert(
      this.targets.length < this.targetsLimit,
      'Targets entities overflowing'
    );
    this.targets.push(TargetEntity.random(this.currentMaxTdd));
  }
}
let targetEntityController = new TargetEntityController();

// ============================================================================
// HTML Manager

class HTMLManager {
  instructionsPerGameStatus = {};

  constructor() {
    this.instructionsPerGameStatus[GameStatus.NewGame] =
      'Dont let em loose and dont miss • Fire to start game';
    this.instructionsPerGameStatus[GameStatus.Playing] =
      'Playing • Spacebar to pause';
    this.instructionsPerGameStatus[GameStatus.Paused] =
      'Paused • Fire to start';
    this.instructionsPerGameStatus[GameStatus.GameOver] =
      'All Hell Loose • Fire to re-start';
  }

  update() {
    dom('ui-instructions').innerText =
      this.instructionsPerGameStatus[gameConfig.status];
    const lives =
      gameConfig.status === GameStatus.GameOver
        ? '🕱'
        : '♥'.repeat(gameManager.currentLives);
    const allScore = `${lives} • ${gameManager.currentScore}`;
    dom('ui-all-score').innerText = allScore;
  }
}
const htmlManager = new HTMLManager();

// ============================================================================
// Game Manager

class GameManager {
  /**
   * If game is in progress
   * @type {boolean}
   */
  isGameInProgress = false;

  /**
   * Current score i.e. number of hits that killed target
   * @type {number}
   */
  currentScore = 0;

  /**
   * Current misses i.e. number of hits that missed target
   * @type {number}
   */
  currentMiss = 0;

  currentLives = GAME_LIVES_AT_START;

  startGame() {
    sound.start();
    this.isGameInProgress = true;
  }

  resetGame() {
    this.isGameInProgress = false;
    targetEntityController = new TargetEntityController();

    // Reset all scores
    this.currentLives = GAME_LIVES_AT_START;
    this.currentMiss = 0;
    this.currentScore = 0;

    // Pause game
    gameOver();

    sound.over();
  }

  pauseGame() {
    this.isGameInProgress = false;
  }

  didHit() {
    this.currentScore += 1;
    sound.shoot();

    console.info(`[hit] current score: ${this.currentScore}`);
  }

  didMiss() {
    this.currentMiss += 1;
    this.currentLives -= 1;
    console.info(
      `[miss] curent misses: ${this.currentMiss}, current lives: ${this.currentLives}`
    );

    // Its game over of there are no more lives.
    if (this.currentLives <= 0) {
      this.resetGame();
      return;
    }

    sound.miss();
  }
}
const gameManager = new GameManager();

// ============================================================================
// Game engine callbacks

function engineDidInitialize() {
  htmlManager.update();
}

function engineDidPause() {
  gameManager.pauseGame();
  htmlManager.update();
}

function engineDidPlay() {
  gameManager.startGame();
  htmlManager.update();
}

function engineDidUpdate() {
  if (gameManager.isGameInProgress) {
    targetEntityController.update();
  }

  htmlManager.update();
}

function engineDidDraw() {
  // Clear rect first
  ctx.clearRect(0, 0, gameConfig.width, gameConfig.height);

  targetEntityController.draw();
}

/**
 * User did left click on canvas
 * @param {{x: number, y: number}} coordinate coordinates of left click relative to canvas
 */
function engineDidLeftClick(coordinate) {
  targetEntityController.shootAt = coordinate;
}

// ============================================================================

function gameLoop() {
  engineDidUpdate();
  engineDidDraw();
}

// ============================================================================
// DOM Event Listners

/**
 * Called when user pressed a key
 * @param {KeyboardEvent} event
 */
function didKeyDown(event) {
  // Play or pause game if "Spacebar" is pressed
  if (event.key === ' ') {
    gameConfig.paused() ? play() : pause();
  }
}

/**
 * Called on mouse click
 * @param {MouseEvent} event
 */
function didClick(event) {
  if (event.button !== 0) {
    return;
  }

  const { clientX, clientY } = event;
  const { x, y } = canvasEl.getBoundingClientRect();
  const relativeXY = { x: clientX - x, y: clientY - y };

  if (!gameConfig.paused()) {
    engineDidLeftClick(relativeXY);
  } else {
    // Start the game
    play();
  }
}

// ============================================================================
// Game Lifecycle

function pause() {
  gameConfig.status = GameStatus.Paused;
  console.info('[game] paused');

  engineDidPause();
}

function play() {
  // Clear console if started playing after Game Over
  if (gameConfig.status === GameStatus.GameOver) {
    console.clear();
  }

  gameConfig.status = GameStatus.Playing;
  console.info('[game] started');

  engineDidPlay();

  startGameLoop();
}

function gameOver() {
  console.info('[game] over');
  gameConfig.status = GameStatus.GameOver;
}

// ============================================================================
// Game Loop Triggering

function startGameLoop() {
  console.assert(!gameConfig.paused(), 'starting loop when game is paused');
  window.requestAnimationFrame(triggerGameLoop);
}

function triggerGameLoop() {
  // Request for next frame
  if (!gameConfig.paused()) {
    window.requestAnimationFrame(triggerGameLoop);
  }

  // Trigger game loop according to FPS
  const now = Date.now();
  const elapsed = now - gameConfig.then;
  if (elapsed > gameConfig.fpsInterval) {
    gameConfig.then = now - (elapsed % gameConfig.fpsInterval);

    // Game Loop
    gameLoop();
  }
}

// ============================================================================
// Game Initialization

/**
 * Initializes game configutation
 * - Adds event listners
 * - Sets canvas size
 */
function initializeGame() {
  console.info('[intialize]');
  addEventListners();

  gameConfig.width = canvasEl.clientWidth;
  gameConfig.height = canvasEl.clientHeight;
  canvasEl.width = gameConfig.width;
  canvasEl.height = gameConfig.height;

  ctx.imageSmoothingEnabled = false;

  engineDidInitialize();
}

function addEventListners() {
  // Add key press event listener
  document.addEventListener('keydown', didKeyDown);

  // Add mouse click listner
  canvasEl.addEventListener('click', didClick);
}
