// Simple jsgame starter
// A simple starter using vite for creating a javascript game that works in web and jsgamelauncher

import { createResourceLoader, drawLoadingScreen, getInput } from "./utils.js";

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const { width, height } = canvas;
let lastTime;
let lastInputTime = 0;
const inputCooldown = 100; // ms between allowed inputs - reduced for better responsiveness

const resources = createResourceLoader();

// Game constants
const GRID_SIZE = 4;
// Calculate responsive padding based on available space
const BOARD_PADDING_PERCENT = 0.03; // Reduce padding to 3% of width
const CELL_PADDING_PERCENT = 0.005; // Reduce cell padding to 0.5% of width
const BOARD_PADDING = width * BOARD_PADDING_PERCENT;
const CELL_PADDING = width * CELL_PADDING_PERCENT;
// Dynamic calculation to ensure the board fits within the canvas
const BOARD_SIZE = Math.min(
  width - BOARD_PADDING * 2,
  height - BOARD_PADDING * 4,
);
const CELL_SIZE = (BOARD_SIZE - CELL_PADDING * (GRID_SIZE + 1)) / GRID_SIZE;
const FONT_SIZE = CELL_SIZE * 0.4;

// Color palette
const COLORS = {
  background: "#faf8ef",
  board: "#bbada0",
  emptyCellColor: "#cdc1b4",
  textLight: "#f9f6f2",
  textDark: "#776e65",
  tile2: "#eee4da",
  tile4: "#ede0c8",
  tile8: "#f2b179",
  tile16: "#f59563",
  tile32: "#f67c5f",
  tile64: "#f65e3b",
  tile128: "#edcf72",
  tile256: "#edcc61",
  tile512: "#edc850",
  tile1024: "#edc53f",
  tile2048: "#edc22e",
  tileSuper: "#3c3a32",
};

// Game state
const game = {
  grid: Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill(0)),
  score: 0,
  bestScore: 0,
  gameOver: false,
  won: false,
  moveInProgress: false,
  animationProgress: 0,
  animationStartTime: 0,
  animationDuration: 80, // ms - significantly faster animations
  animationQueue: [], // [{from: {row, col}, to: {row, col}, value}]
  mergeQueue: [], // [{row, col, value}]
};

// Initialize the game
function initGame() {
  // Clear the grid
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      game.grid[row][col] = 0;
    }
  }

  // Add two random tiles
  addRandomTile();
  addRandomTile();

  game.score = 0;
  game.gameOver = false;
  game.won = false;
  game.animationQueue = [];
  game.mergeQueue = [];
}

// Add a random tile (2 or 4) to an empty cell
function addRandomTile() {
  const emptyCells = [];

  // Find all empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (game.grid[row][col] === 0) {
        emptyCells.push({ row, col });
      }
    }
  }

  // If there are no empty cells, return
  if (emptyCells.length === 0) return;

  // Choose a random empty cell
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];

  // Add a 2 (90% chance) or 4 (10% chance)
  game.grid[cell.row][cell.col] = Math.random() < 0.9 ? 2 : 4;
}

// Check if the game is over
function checkGameOver() {
  // Check if there are any empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (game.grid[row][col] === 0) {
        return false;
      }
    }
  }

  // Check if there are any possible merges
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const current = game.grid[row][col];

      // Check right
      if (col < GRID_SIZE - 1 && game.grid[row][col + 1] === current) {
        return false;
      }

      // Check below
      if (row < GRID_SIZE - 1 && game.grid[row + 1][col] === current) {
        return false;
      }
    }
  }

  return true;
}

// Check if the game is won (has a 2048 tile)
function checkWin() {
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (game.grid[row][col] === 2048) {
        return true;
      }
    }
  }

  return false;
}

// Move logic
function moveLeft() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    let lastMergeCol = -1; // Keep track of the last column where a merge happened

    for (let col = 1; col < GRID_SIZE; col++) {
      if (game.grid[row][col] === 0) continue;

      let moveToCol = col;

      // Try to move to the leftmost possible position
      while (moveToCol > 0 && game.grid[row][moveToCol - 1] === 0) {
        moveToCol--;
      }

      // Check if we can merge with the tile to the left
      if (
        moveToCol > 0 &&
        game.grid[row][moveToCol - 1] === game.grid[row][col] &&
        moveToCol - 1 > lastMergeCol
      ) {
        // Merge
        game.grid[row][moveToCol - 1] *= 2;
        game.score += game.grid[row][moveToCol - 1];
        game.bestScore = Math.max(game.bestScore, game.score);
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol - 1 },
          value: game.grid[row][col],
        });

        // Add to merge queue
        game.mergeQueue.push({
          row,
          col: moveToCol - 1,
          value: game.grid[row][moveToCol - 1],
        });

        lastMergeCol = moveToCol - 1;
        moved = true;
      }
      // Move to the empty space
      else if (moveToCol < col) {
        game.grid[row][moveToCol] = game.grid[row][col];
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol },
          value: game.grid[row][moveToCol],
        });

        moved = true;
      }
    }
  }

  return moved;
}

function moveRight() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    let lastMergeCol = GRID_SIZE; // Keep track of the last column where a merge happened

    for (let col = GRID_SIZE - 2; col >= 0; col--) {
      if (game.grid[row][col] === 0) continue;

      let moveToCol = col;

      // Try to move to the rightmost possible position
      while (moveToCol < GRID_SIZE - 1 && game.grid[row][moveToCol + 1] === 0) {
        moveToCol++;
      }

      // Check if we can merge with the tile to the right
      if (
        moveToCol < GRID_SIZE - 1 &&
        game.grid[row][moveToCol + 1] === game.grid[row][col] &&
        moveToCol + 1 < lastMergeCol
      ) {
        // Merge
        game.grid[row][moveToCol + 1] *= 2;
        game.score += game.grid[row][moveToCol + 1];
        game.bestScore = Math.max(game.bestScore, game.score);
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol + 1 },
          value: game.grid[row][col],
        });

        // Add to merge queue
        game.mergeQueue.push({
          row,
          col: moveToCol + 1,
          value: game.grid[row][moveToCol + 1],
        });

        lastMergeCol = moveToCol + 1;
        moved = true;
      }
      // Move to the empty space
      else if (moveToCol > col) {
        game.grid[row][moveToCol] = game.grid[row][col];
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol },
          value: game.grid[row][moveToCol],
        });

        moved = true;
      }
    }
  }

  return moved;
}

function moveUp() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  for (let col = 0; col < GRID_SIZE; col++) {
    let lastMergeRow = -1; // Keep track of the last row where a merge happened

    for (let row = 1; row < GRID_SIZE; row++) {
      if (game.grid[row][col] === 0) continue;

      let moveToRow = row;

      // Try to move to the topmost possible position
      while (moveToRow > 0 && game.grid[moveToRow - 1][col] === 0) {
        moveToRow--;
      }

      // Check if we can merge with the tile above
      if (
        moveToRow > 0 &&
        game.grid[moveToRow - 1][col] === game.grid[row][col] &&
        moveToRow - 1 > lastMergeRow
      ) {
        // Merge
        game.grid[moveToRow - 1][col] *= 2;
        game.score += game.grid[moveToRow - 1][col];
        game.bestScore = Math.max(game.bestScore, game.score);
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow - 1, col },
          value: game.grid[row][col],
        });

        // Add to merge queue
        game.mergeQueue.push({
          row: moveToRow - 1,
          col,
          value: game.grid[moveToRow - 1][col],
        });

        lastMergeRow = moveToRow - 1;
        moved = true;
      }
      // Move to the empty space
      else if (moveToRow < row) {
        game.grid[moveToRow][col] = game.grid[row][col];
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow, col },
          value: game.grid[moveToRow][col],
        });

        moved = true;
      }
    }
  }

  return moved;
}

function moveDown() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  for (let col = 0; col < GRID_SIZE; col++) {
    let lastMergeRow = GRID_SIZE; // Keep track of the last row where a merge happened

    for (let row = GRID_SIZE - 2; row >= 0; row--) {
      if (game.grid[row][col] === 0) continue;

      let moveToRow = row;

      // Try to move to the bottommost possible position
      while (moveToRow < GRID_SIZE - 1 && game.grid[moveToRow + 1][col] === 0) {
        moveToRow++;
      }

      // Check if we can merge with the tile below
      if (
        moveToRow < GRID_SIZE - 1 &&
        game.grid[moveToRow + 1][col] === game.grid[row][col] &&
        moveToRow + 1 < lastMergeRow
      ) {
        // Merge
        game.grid[moveToRow + 1][col] *= 2;
        game.score += game.grid[moveToRow + 1][col];
        game.bestScore = Math.max(game.bestScore, game.score);
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow + 1, col },
          value: game.grid[row][col],
        });

        // Add to merge queue
        game.mergeQueue.push({
          row: moveToRow + 1,
          col,
          value: game.grid[moveToRow + 1][col],
        });

        lastMergeRow = moveToRow + 1;
        moved = true;
      }
      // Move to the empty space
      else if (moveToRow > row) {
        game.grid[moveToRow][col] = game.grid[row][col];
        game.grid[row][col] = 0;

        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow, col },
          value: game.grid[moveToRow][col],
        });

        moved = true;
      }
    }
  }

  return moved;
}

// Helpers for drawing
function getCellPosition(row, col) {
  // Calculate board position (centered horizontally)
  const boardX = (width - BOARD_SIZE) / 2;
  const boardY = BOARD_PADDING * 2; // Leave space for score at top

  const x = boardX + col * (CELL_SIZE + CELL_PADDING) + CELL_PADDING;
  const y = boardY + row * (CELL_SIZE + CELL_PADDING) + CELL_PADDING;
  return { x, y };
}

function getTileColor(value) {
  if (value <= 2048) {
    return COLORS[`tile${value}`];
  }
  return COLORS.tileSuper;
}

function getTextColor(value) {
  return value <= 4 ? COLORS.textDark : COLORS.textLight;
}

// Draw functions
function drawBoard() {
  // Draw background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // Center the board on the canvas
  const boardX = (width - BOARD_SIZE) / 2;
  const boardY = BOARD_PADDING * 2; // Leave space for score at top

  // Draw board background (centered)
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(
    boardX - CELL_PADDING / 2,
    boardY - CELL_PADDING / 2,
    BOARD_SIZE + CELL_PADDING,
    BOARD_SIZE + CELL_PADDING,
  );

  // Draw empty cells
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const { x, y } = getCellPosition(row, col);
      ctx.fillStyle = COLORS.emptyCellColor;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
    }
  }
}

function drawTile(row, col, value, scale = 1, offsetX = 0, offsetY = 0) {
  if (value === 0) return;

  const { x, y } = getCellPosition(row, col);
  const scaledSize = CELL_SIZE * scale;
  const xPos = x + offsetX + (CELL_SIZE - scaledSize) / 2;
  const yPos = y + offsetY + (CELL_SIZE - scaledSize) / 2;

  // Draw tile background
  ctx.fillStyle = getTileColor(value);
  ctx.fillRect(xPos, yPos, scaledSize, scaledSize);

  // Draw tile text
  ctx.fillStyle = getTextColor(value);

  let fontSize = FONT_SIZE * scale;

  // Adjust font size for larger numbers
  if (value > 999) {
    fontSize *= 0.7;
  } else if (value > 99) {
    fontSize *= 0.8;
  } else if (value > 9) {
    fontSize *= 0.9;
  }

  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value.toString(), xPos + scaledSize / 2, yPos + scaledSize / 2);
}

function drawAnimations(deltaTime) {
  if (game.animationQueue.length === 0) return;

  if (game.animationProgress === 0) {
    game.animationStartTime = performance.now();
  }

  game.animationProgress = Math.min(
    1,
    (performance.now() - game.animationStartTime) / game.animationDuration,
  );

  // Use a faster linear animation for more responsiveness
  const progress = game.animationProgress;

  // Draw animated tiles
  for (const anim of game.animationQueue) {
    const fromPos = getCellPosition(anim.from.row, anim.from.col);
    const toPos = getCellPosition(anim.to.row, anim.to.col);

    const x = fromPos.x + (toPos.x - fromPos.x) * progress;
    const y = fromPos.y + (toPos.y - fromPos.y) * progress;

    // Convert to offset relative to final position
    const offsetX = x - toPos.x;
    const offsetY = y - toPos.y;

    // Draw the tile at its current position
    drawTile(anim.to.row, anim.to.col, anim.value, 1, offsetX, offsetY);
  }

  // Draw merge animations - start earlier and make them quicker
  if (game.animationProgress > 0.3) {
    const mergeProgress = (game.animationProgress - 0.3) / 0.7; // Normalize to 0-1 range

    // Simpler, faster scale animation
    const scale = 1 + 0.1 * Math.sin(mergeProgress * Math.PI);

    for (const merge of game.mergeQueue) {
      drawTile(merge.row, merge.col, merge.value, scale);
    }
  }

  // Reset animations when complete
  if (game.animationProgress >= 1) {
    game.animationProgress = 0;
    game.animationQueue = [];
    game.mergeQueue = [];
    game.moveInProgress = false;
  }
}

function drawGameOver() {
  // Semi-transparent overlay
  ctx.fillStyle = "rgba(238, 228, 218, 0.73)";
  ctx.fillRect(0, 0, width, height);

  // Text
  ctx.fillStyle = "#776e65";
  ctx.font = `bold ${FONT_SIZE * 2}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (game.won) {
    ctx.fillText("You Win!", width / 2, height / 2 - FONT_SIZE);
  } else {
    ctx.fillText("Game Over!", width / 2, height / 2 - FONT_SIZE);
  }

  // Restart message
  ctx.font = `bold ${FONT_SIZE}px Arial`;
  ctx.fillText("Press Enter to Restart", width / 2, height / 2 + FONT_SIZE * 2);
}

function drawScore() {
  // Center the score boxes relative to the board
  const boardX = (width - BOARD_SIZE) / 2;
  const scoreBoxWidth = BOARD_SIZE * 0.2;
  const scoreBoxHeight = BOARD_PADDING * 1.5;
  const scoreBoxY = BOARD_PADDING / 2;

  // Position score boxes centered with the board
  const bestBoxX = boardX + BOARD_SIZE * 0.15;
  const scoreBoxX = boardX + BOARD_SIZE * 0.65;

  // Draw best score box
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(bestBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight);

  // Draw best score title
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `bold ${FONT_SIZE * 0.5}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    "BEST",
    bestBoxX + scoreBoxWidth / 2,
    scoreBoxY + scoreBoxHeight * 0.1,
  );

  // Draw best score
  ctx.font = `bold ${FONT_SIZE * 0.8}px Arial`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    game.bestScore.toString(),
    bestBoxX + scoreBoxWidth / 2,
    scoreBoxY + scoreBoxHeight * 0.6,
  );

  // Draw score box
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(scoreBoxX, scoreBoxY, scoreBoxWidth, scoreBoxHeight);

  // Draw score title
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `bold ${FONT_SIZE * 0.5}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(
    "SCORE",
    scoreBoxX + scoreBoxWidth / 2,
    scoreBoxY + scoreBoxHeight * 0.1,
  );

  // Draw score
  ctx.font = `bold ${FONT_SIZE * 0.8}px Arial`;
  ctx.textBaseline = "middle";
  ctx.fillText(
    game.score.toString(),
    scoreBoxX + scoreBoxWidth / 2,
    scoreBoxY + scoreBoxHeight * 0.6,
  );
}

function drawTitle() {
  // Center title with the board
  const boardX = (width - BOARD_SIZE) / 2;

  // Draw 2048 title
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `bold ${FONT_SIZE * 1.5}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("2048", boardX, BOARD_PADDING / 2);
}

function drawInstructions() {
  // Position instructions below the board
  const boardY = BOARD_PADDING * 2;
  const y = boardY + BOARD_SIZE + BOARD_PADDING;

  ctx.fillStyle = COLORS.textDark;
  ctx.font = `${FONT_SIZE * 0.6}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Shorter instruction text to avoid cutoff
  ctx.fillText("Use arrow keys or gamepad to move", width / 2, y);
}

// Update function
function update(elapsedTime) {
  if (!resources.isComplete()) return;

  // If animation is in progress, continue it
  if (game.moveInProgress) {
    return;
  }

  const currentTime = performance.now();

  // Get input
  const [p1] = getInput();

  // Only process input if enough time has passed since the last input
  if (currentTime - lastInputTime > inputCooldown) {
    let moveMade = false;

    if (game.gameOver) {
      // Restart the game if Enter is pressed
      if (p1.START.pressed) {
        initGame();
      }
    } else {
      if (p1.DPAD_LEFT.pressed) {
        moveMade = moveLeft();
        lastInputTime = currentTime;
      } else if (p1.DPAD_RIGHT.pressed) {
        moveMade = moveRight();
        lastInputTime = currentTime;
      } else if (p1.DPAD_UP.pressed) {
        moveMade = moveUp();
        lastInputTime = currentTime;
      } else if (p1.DPAD_DOWN.pressed) {
        moveMade = moveDown();
        lastInputTime = currentTime;
      }

      if (moveMade) {
        game.moveInProgress = true;
        addRandomTile();

        // Check win/lose conditions
        if (!game.won && checkWin()) {
          game.won = true;
        }

        if (checkGameOver()) {
          game.gameOver = true;
        }
      }
    }
  }
}

// Draw function
function draw(deltaTime) {
  if (!resources.isComplete()) {
    drawLoadingScreen(ctx, resources.getPercentComplete());
    return;
  }

  // Draw the board and UI
  drawBoard();

  // Draw static tiles (those not being animated)
  if (!game.moveInProgress) {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        drawTile(row, col, game.grid[row][col]);
      }
    }
  } else {
    // During animation, draw only the destination tiles that aren't being animated
    const animatedPositions = new Set();

    for (const anim of game.animationQueue) {
      animatedPositions.add(`${anim.to.row},${anim.to.col}`);
    }

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!animatedPositions.has(`${row},${col}`)) {
          drawTile(row, col, game.grid[row][col]);
        }
      }
    }

    // Draw the animations
    drawAnimations(deltaTime);
  }

  // Draw UI elements
  drawScore();
  drawTitle();
  drawInstructions();

  // Draw game over screen if applicable
  if (game.gameOver || game.won) {
    drawGameOver();
  }
}

// Game loop
function gameLoop(time) {
  const deltaTime = lastTime ? time - lastTime : 0;

  update(deltaTime);
  draw(deltaTime);

  lastTime = time;
  requestAnimationFrame(gameLoop);
}

// Initialize and start the game
initGame();
gameLoop(0);
