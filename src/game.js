/** @type {HTMLCanvasElement} */
const canvasEl = document.getElementById('game');

/** @type {CanvasRenderingContext2D} */
const ctx = canvasEl.getContext('2d');

const TARGET_ENTITY_RADIUS = 25;
const TARGET_ENTITY_TTD = 20;

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
   * Shoot at this coordinates at next update
   * This should be most recent left clicks
   *
   * @type {{x: number, y: number} | undefined}
   * @public
   */
  shootAt = undefined;

  update() {
    // Update existing targets
    this.targets.forEach((entity) => {
      // Check whether user shot any entity
      if (this.shootAt && entity.canCollideWith(this.shootAt)) {
        entity.ttd = 0; // Immediatly shoot the entity
      }

      entity.update();
    });

    // Remove the targets which are dead
    this.targets = this.targets.filter((entity) => entity.ttd >= 0);

    // Generate new target if needed
    if (this.targets.length !== 1) {
      this.generateNewTarget();
    }

    // Clear the previous shot
    this.shootAt = undefined;
  }

  draw() {
    this.targets.forEach((entity) => entity.draw());
  }

  generateNewTarget() {
    this.targets.push(TargetEntity.random());
  }
}
const targetEntityController = new TargetEntityController();

// ============================================================================
// Game engine callbacks

function updateGame() {
  targetEntityController.update();
}

function drawGame() {
  // Clear rect first
  ctx.clearRect(0, 0, gameConfig.width, gameConfig.height);

  targetEntityController.draw();
}

/**
 * User did left click on canvas
 * @param {{x: number, y: number}} coordinate coordinates of left click relative to canvas
 */
function didLeftClick(coordinate) {
  targetEntityController.shootAt = coordinate;
}

// ============================================================================

function gameLoop() {
  updateGame();
  drawGame();
}

// ============================================================================
// DOM Event Listners

/**
 * Called when user pressed a key
 * @param {KeyboardEvent} event
 */
function didKeyDown(event) {
  console.log(`[Did key down: ${event.key}]`);

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
  console.info('Did Click', relativeXY);

  didLeftClick(relativeXY);
}

// ============================================================================
// Game Lifecycle

function pause() {
  gameConfig.paused = true;
  console.info('[game] paused');
}

function play() {
  gameConfig.paused = false;
  console.info('[game] started');

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
