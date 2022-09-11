/** @type {HTMLCanvasElement} */
const canvasEl = document.getElementById('game');

/** @type {CanvasRenderingContext2D} */
const ctx = canvasEl.getContext('2d');

const TARGET_ENTITY_RADIUS = 25;
const TARGET_ENTITY_TTD = 20;
const TARGET_ENTITY_START_TTD = 20;

const gameConfig = {
  // Loop configs
  fps: 10,
  fpsInterval: 1000 / 10, // TODO: 1000 / fps
  then: Date.now(),

  // Game variables
  width: 500,
  height: 500,
  paused: true,
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
    this.r2 = r ** 2;
    this.ttd = ttd;
  }

  /**
   * Returns Target Entity at random co-ordinates
   * @returns {TargetEntity}
   */
  static random() {
    const r = TARGET_ENTITY_RADIUS + 1;
    return new TargetEntity(
      randomNumber(r, gameConfig.width - r),
      randomNumber(r, gameConfig.height - r),
      TARGET_ENTITY_RADIUS,
      TARGET_ENTITY_TTD
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
 * @constructor
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
  }

  draw() {
    this.targets.forEach((entity) => entity.draw());
  }

  clearEntities() {
    this.targets = [];
  }

  generateNewTarget() {
    console.assert(
      this.targets.length < this.targetsLimit,
      'Targets entities overflowing'
    );
    this.targets.push(TargetEntity.random());
  }
}
const targetEntityController = new TargetEntityController();

// ============================================================================
// Game Manager

class GameManager {
  /**
   * If game is in progress
   * @type {boolean}
   * @public
   */
  isGameInProgress = false;

  /**
   * Current score i.e. number of hits that killed target
   * @type {number}
   * @private
   */
  currentScore = 0;

  /**
   * Current misses i.e. number of hits that missed target
   * @type {number}
   * @private
   */
  currentMiss = 0;

  startGame() {
    this.isGameInProgress = true;
  }

  pauseGame() {
    this.isGameInProgress = false;
  }

  didHit() {
    this.currentScore += 1;
    console.info(`[hit] current score: ${this.currentScore}`);
  }

  didMiss() {
    this.currentMiss += 1;
    console.info(`[miss] current misses: ${this.currentMiss}`);
  }
}
const gameManager = new GameManager();

// ============================================================================
// Game engine callbacks

function engineDidPause() {
  gameManager.pauseGame();
}

function engineDidPlay() {
  gameManager.startGame();
}

function engineDidUpdate() {
  if (gameManager.isGameInProgress) {
    targetEntityController.update();
  }
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
    gameConfig.paused ? play() : pause();
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

  if (!gameConfig.paused) {
    engineDidLeftClick(relativeXY);
  }
}

// ============================================================================
// Game Lifecycle

function pause() {
  gameConfig.paused = true;
  console.info('[game] paused');

  engineDidPause();
}

function play() {
  gameConfig.paused = false;
  console.info('[game] started');

  engineDidPlay();

  startGameLoop();
}

// ============================================================================
// Game Loop Triggering

function startGameLoop() {
  console.assert(!gameConfig.paused, 'starting loop when game is paused');
  window.requestAnimationFrame(triggerGameLoop);
}

function triggerGameLoop() {
  // Request for next frame
  if (!gameConfig.paused) {
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

  canvasEl.width = gameConfig.width;
  canvasEl.height = gameConfig.height;
}

function addEventListners() {
  // Add key press event listener
  document.addEventListener('keydown', didKeyDown);

  // Add mouse click listner
  canvasEl.addEventListener('click', didClick);
}
