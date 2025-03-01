// Simple jsgame starter
// A simple starter using vite for creating a javascript game that works in web and jsgamelauncher

import { createResourceLoader, drawLoadingScreen, getInput } from './utils.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const { width, height } = canvas;
let lastTime = 0;
let lastInputTime = 0;
const inputCooldown = 80; // ms between allowed inputs - very responsive

const resources = createResourceLoader();

// Game constants
const GRID_SIZE = 4;
const SIDE_PANEL_WIDTH = width * 0.25; // Left panel for scores and title
const BOARD_PADDING = Math.max(8, width * 0.02);
const CELL_PADDING = Math.max(4, width * 0.005);

// Calculate board size to fit within available space (positioned on right side)
const BOARD_SIZE = Math.min(width - SIDE_PANEL_WIDTH - BOARD_PADDING * 2, height - BOARD_PADDING * 2);
const CELL_SIZE = (BOARD_SIZE - CELL_PADDING * (GRID_SIZE + 1)) / GRID_SIZE;
const FONT_SIZE = Math.max(15, CELL_SIZE * 0.35);

// Color palette
const COLORS = {
  background: '#faf8ef',
  board: '#bbada0',
  emptyCellColor: '#cdc1b4',
  textLight: '#f9f6f2',
  textDark: '#776e65',
  tile2: '#eee4da',
  tile4: '#ede0c8',
  tile8: '#f2b179',
  tile16: '#f59563',
  tile32: '#f67c5f',
  tile64: '#f65e3b',
  tile128: '#edcf72',
  tile256: '#edcc61',
  tile512: '#edc850',
  tile1024: '#edc53f',
  tile2048: '#edc22e',
  tileSuper: '#3c3a32',
  sidePanel: '#f5f0e7'  // Slightly different shade for side panel
};

// Game state
const game = {
  grid: Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0)),
  score: 0,
  bestScore: 0,
  gameOver: false,
  won: false,
  moveInProgress: false,
  animationProgress: 0,
  animationStartTime: 0,
  animationDuration: 30, // ultra fast animations for immediate feedback
  animationQueue: [],
  mergeQueue: []
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
  const value = Math.random() < 0.9 ? 2 : 4;
  game.grid[cell.row][cell.col] = value;

  // Add a "pop in" animation for the new tile
  game.mergeQueue.push({
    row: cell.row,
    col: cell.col,
    value: value,
    isNew: true  // Flag to indicate this is a new tile
  });
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

// MOVE FUNCTIONS
function moveLeft() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  // First move all tiles left as far as possible
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 1; col < GRID_SIZE; col++) {
      if (game.grid[row][col] === 0) continue;

      let moveToCol = col;
      while (moveToCol > 0 && game.grid[row][moveToCol - 1] === 0) {
        moveToCol--;
      }

      if (moveToCol < col) {
        // Track animation
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol },
          value: game.grid[row][col]
        });

        // Move tile
        game.grid[row][moveToCol] = game.grid[row][col];
        game.grid[row][col] = 0;
        moved = true;
      }
    }
  }

  // Then check for merges
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE - 1; col++) {
      if (game.grid[row][col] === 0 || game.grid[row][col] !== game.grid[row][col+1]) continue;

      // Merge identical tiles
      game.grid[row][col] *= 2;
      game.score += game.grid[row][col];
      game.bestScore = Math.max(game.bestScore, game.score);

      // Add to merge animation queue
      game.mergeQueue.push({
        row, col, value: game.grid[row][col]
      });

      // Add to movement animation queue
      game.animationQueue.push({
        from: { row, col: col+1 },
        to: { row, col },
        value: game.grid[row][col] / 2
      });

      // Shift all tiles right of this to the left
      for (let c = col + 1; c < GRID_SIZE - 1; c++) {
        game.grid[row][c] = game.grid[row][c+1];
        // Add animation if the cell to the right has a tile
        if (game.grid[row][c+1] !== 0) {
          game.animationQueue.push({
            from: { row, col: c+1 },
            to: { row, col: c },
            value: game.grid[row][c]
          });
        }
      }

      // Clear rightmost cell
      game.grid[row][GRID_SIZE-1] = 0;
      moved = true;
    }
  }

  return moved;
}

function moveRight() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  // First move all tiles right as far as possible
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = GRID_SIZE - 2; col >= 0; col--) {
      if (game.grid[row][col] === 0) continue;

      let moveToCol = col;
      while (moveToCol < GRID_SIZE - 1 && game.grid[row][moveToCol + 1] === 0) {
        moveToCol++;
      }

      if (moveToCol > col) {
        // Track animation
        game.animationQueue.push({
          from: { row, col },
          to: { row, col: moveToCol },
          value: game.grid[row][col]
        });

        // Move tile
        game.grid[row][moveToCol] = game.grid[row][col];
        game.grid[row][col] = 0;
        moved = true;
      }
    }
  }

  // Then check for merges
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = GRID_SIZE - 1; col > 0; col--) {
      if (game.grid[row][col] === 0 || game.grid[row][col] !== game.grid[row][col-1]) continue;

      // Merge identical tiles
      game.grid[row][col] *= 2;
      game.score += game.grid[row][col];
      game.bestScore = Math.max(game.bestScore, game.score);

      // Add to merge animation queue
      game.mergeQueue.push({
        row, col, value: game.grid[row][col]
      });

      // Add to movement animation queue
      game.animationQueue.push({
        from: { row, col: col-1 },
        to: { row, col },
        value: game.grid[row][col] / 2
      });

      // Shift all tiles left of this to the right
      for (let c = col - 1; c > 0; c--) {
        game.grid[row][c] = game.grid[row][c-1];
        // Add animation if the cell to the left has a tile
        if (game.grid[row][c-1] !== 0) {
          game.animationQueue.push({
            from: { row, col: c-1 },
            to: { row, col: c },
            value: game.grid[row][c]
          });
        }
      }

      // Clear leftmost cell
      game.grid[row][0] = 0;
      moved = true;
    }
  }

  return moved;
}

function moveUp() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  // First move all tiles up as far as possible
  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 1; row < GRID_SIZE; row++) {
      if (game.grid[row][col] === 0) continue;

      let moveToRow = row;
      while (moveToRow > 0 && game.grid[moveToRow - 1][col] === 0) {
        moveToRow--;
      }

      if (moveToRow < row) {
        // Track animation
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow, col },
          value: game.grid[row][col]
        });

        // Move tile
        game.grid[moveToRow][col] = game.grid[row][col];
        game.grid[row][col] = 0;
        moved = true;
      }
    }
  }

  // Then check for merges
  for (let col = 0; col < GRID_SIZE; col++) {
    for (let row = 0; row < GRID_SIZE - 1; row++) {
      if (game.grid[row][col] === 0 || game.grid[row][col] !== game.grid[row+1][col]) continue;

      // Merge identical tiles
      game.grid[row][col] *= 2;
      game.score += game.grid[row][col];
      game.bestScore = Math.max(game.bestScore, game.score);

      // Add to merge animation queue
      game.mergeQueue.push({
        row, col, value: game.grid[row][col]
      });

      // Add to movement animation queue
      game.animationQueue.push({
        from: { row: row+1, col },
        to: { row, col },
        value: game.grid[row][col] / 2
      });

      // Shift all tiles below up one position
      for (let r = row + 1; r < GRID_SIZE - 1; r++) {
        game.grid[r][col] = game.grid[r+1][col];
        // Add animation if the cell below has a tile
        if (game.grid[r+1][col] !== 0) {
          game.animationQueue.push({
            from: { row: r+1, col },
            to: { row: r, col },
            value: game.grid[r+1][col]
          });
        }
      }

      // Clear bottom cell
      game.grid[GRID_SIZE-1][col] = 0;
      moved = true;
    }
  }

  return moved;
}

function moveDown() {
  let moved = false;
  game.animationQueue = [];
  game.mergeQueue = [];

  for (let col = 0; col < GRID_SIZE; col++) {
    // First pass: move everything down
    for (let row = GRID_SIZE - 2; row >= 0; row--) {
      if (game.grid[row][col] === 0) continue;

      let moveToRow = row;

      // Find bottommost empty position
      while (moveToRow < GRID_SIZE - 1 && game.grid[moveToRow + 1][col] === 0) {
        moveToRow++;
      }

      // Only update if the tile actually moved
      if (moveToRow > row) {
        // Add to animation queue
        game.animationQueue.push({
          from: { row, col },
          to: { row: moveToRow, col },
          value: game.grid[row][col]
        });

        // Update grid
        game.grid[moveToRow][col] = game.grid[row][col];
        game.grid[row][col] = 0;
        moved = true;
      }
    }

    // Second pass: merge tiles
    for (let row = GRID_SIZE - 1; row > 0; row--) {
      if (game.grid[row][col] !== 0 &&
          game.grid[row][col] === game.grid[row - 1][col]) {

        // Merge tiles
        game.grid[row][col] *= 2;
        game.score += game.grid[row][col];
        game.bestScore = Math.max(game.bestScore, game.score);

        // Add to merge queue
        game.mergeQueue.push({
          row,
          col,
          value: game.grid[row][col]
        });

        // Add animation for the merged tile
        game.animationQueue.push({
          from: { row: row - 1, col },
          to: { row, col },
          value: game.grid[row][col] / 2
        });

        // Shift all tiles up
        for (let r = row - 1; r > 0; r--) {
          game.grid[r][col] = game.grid[r - 1][col];

          if (game.grid[r][col] !== 0) {
            // Add animation for shifted tile
            game.animationQueue.push({
              from: { row: r - 1, col },
              to: { row: r, col },
              value: game.grid[r][col]
            });
          }
        }

        // Clear the top cell
        game.grid[0][col] = 0;
        moved = true;
      }
    }
  }

  return moved;
}

// Helper functions for drawing
function getCellPosition(row, col) {
  // Position board on right side of screen
  const boardX = SIDE_PANEL_WIDTH + BOARD_PADDING;
  const boardY = (height - BOARD_SIZE) / 2;

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

  // Draw side panel background with subtle difference
  ctx.fillStyle = COLORS.sidePanel;
  ctx.fillRect(0, 0, SIDE_PANEL_WIDTH, height);

  // Position board on right side of screen
  const boardX = SIDE_PANEL_WIDTH + BOARD_PADDING;
  const boardY = (height - BOARD_SIZE) / 2;

  // Draw board background
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(
    boardX - CELL_PADDING / 2,
    boardY - CELL_PADDING / 2,
    BOARD_SIZE + CELL_PADDING,
    BOARD_SIZE + CELL_PADDING
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
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toString(), xPos + scaledSize / 2, yPos + scaledSize / 2);
}

function drawAnimations() {
  if (game.animationQueue.length === 0 && game.mergeQueue.length === 0) return;

  if (game.animationProgress === 0) {
    game.animationStartTime = performance.now();
  }

  game.animationProgress = Math.min(1, (performance.now() - game.animationStartTime) / game.animationDuration);

  // Super fast linear animation - no easing for faster response
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

  // Animation for new tiles and merged tiles
  for (const merge of game.mergeQueue) {
    // Scale from 0 to 1 for new tiles, pulse effect for merged tiles
    const scale = merge.isNew
      ? progress
      : 1 + 0.1 * Math.sin(progress * Math.PI);

    drawTile(merge.row, merge.col, merge.value, scale);
  }

  // Reset animations when complete
  if (game.animationProgress >= 1) {
    // Force a redraw of the entire grid to ensure consistency
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (game.grid[row][col] > 0) {
          drawTile(row, col, game.grid[row][col]);
        }
      }
    }

    game.animationProgress = 0;
    game.animationQueue = [];
    game.mergeQueue = [];
    game.moveInProgress = false;
  }
}

function drawScore() {
  // Draw in left side panel
  const padding = BOARD_PADDING;
  const scoreBoxWidth = SIDE_PANEL_WIDTH - padding * 2;
  const scoreBoxHeight = FONT_SIZE * 3;

  // Draw title first (at top of side panel)
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `bold ${FONT_SIZE * 2}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('2048', SIDE_PANEL_WIDTH / 2, padding * 2);

  // Draw score box (below title)
  const scoreBoxY = padding * 2 + FONT_SIZE * 3;
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(padding, scoreBoxY, scoreBoxWidth, scoreBoxHeight);

  // Draw score title
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `bold ${FONT_SIZE * 0.6}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE', SIDE_PANEL_WIDTH / 2, scoreBoxY + padding / 2);

  // Draw score
  ctx.font = `bold ${FONT_SIZE}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.fillText(game.score.toString(), SIDE_PANEL_WIDTH / 2, scoreBoxY + scoreBoxHeight / 2 + padding / 2);

  // Draw best score box (below score)
  const bestBoxY = scoreBoxY + scoreBoxHeight + padding;
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(padding, bestBoxY, scoreBoxWidth, scoreBoxHeight);

  // Draw best score title
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `bold ${FONT_SIZE * 0.6}px Arial`;
  ctx.textBaseline = 'top';
  ctx.fillText('BEST', SIDE_PANEL_WIDTH / 2, bestBoxY + padding / 2);

  // Draw best score
  ctx.font = `bold ${FONT_SIZE}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.fillText(game.bestScore.toString(), SIDE_PANEL_WIDTH / 2, bestBoxY + scoreBoxHeight / 2 + padding / 2);

  // Draw New Game button
  const buttonY = bestBoxY + scoreBoxHeight + padding * 2;
  const buttonHeight = FONT_SIZE * 2;
  ctx.fillStyle = '#8f7a66';  // Button color
  ctx.fillRect(padding, buttonY, scoreBoxWidth, buttonHeight);

  // Button text
  ctx.fillStyle = COLORS.textLight;
  ctx.font = `bold ${FONT_SIZE * 0.8}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.fillText('NEW GAME', SIDE_PANEL_WIDTH / 2, buttonY + buttonHeight / 2);

  // Draw instructions (further up to avoid overlay with button)
  const instructionsY = buttonY + buttonHeight + padding * 4;
  ctx.fillStyle = COLORS.textDark;
  ctx.font = `${FONT_SIZE * 0.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';  // Changed to top alignment

  // Instructions with more spacing
  ctx.fillText('Use arrow keys', SIDE_PANEL_WIDTH / 2, instructionsY);
  ctx.fillText('to move tiles', SIDE_PANEL_WIDTH / 2, instructionsY + FONT_SIZE);
}

function drawGameOver() {
  // Get board position for overlay
  const boardX = SIDE_PANEL_WIDTH + BOARD_PADDING;
  const boardY = (height - BOARD_SIZE) / 2;

  // Semi-transparent overlay over just the board area
  ctx.fillStyle = 'rgba(238, 228, 218, 0.73)';
  ctx.fillRect(boardX - CELL_PADDING / 2, boardY - CELL_PADDING / 2,
               BOARD_SIZE + CELL_PADDING, BOARD_SIZE + CELL_PADDING);

  // Text
  ctx.fillStyle = '#776e65';
  ctx.font = `bold ${FONT_SIZE * 1.5}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const centerX = boardX + BOARD_SIZE / 2;
  const centerY = boardY + BOARD_SIZE / 2;

  if (game.won) {
    ctx.fillText('You Win!', centerX, centerY - FONT_SIZE);
  } else {
    ctx.fillText('Game Over!', centerX, centerY - FONT_SIZE);
  }

  // Restart message
  ctx.font = `bold ${FONT_SIZE * 0.8}px Arial`;
  ctx.fillText('Press Enter to Restart', centerX, centerY + FONT_SIZE * 2);
}

// Update function
function update(deltaTime) {
  if (!resources.isComplete()) return;

  // Skip if animation is in progress
  if (game.moveInProgress) {
    return;
  }

  const currentTime = performance.now();

  // Get input
  const [p1] = getInput();

  // Only process input if enough time has passed
  if (currentTime - lastInputTime > inputCooldown) {
    let moveMade = false;

    if (game.gameOver) {
      // Restart the game if Enter is pressed
      if (p1.START.pressed || p1.BUTTON_SOUTH.pressed) {
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
      } else if (p1.START.pressed || p1.BUTTON_SOUTH.pressed) {
        // New game button press (Enter or Space/South button)
        initGame();
        lastInputTime = currentTime;
        return;
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
function draw() {
  if (!resources.isComplete()) {
    drawLoadingScreen(ctx, resources.getPercentComplete());
    return;
  }

  // Draw the board and UI
  drawBoard();

  // Draw tiles
  if (!game.moveInProgress) {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        drawTile(row, col, game.grid[row][col]);
      }
    }
  } else {
    // During animation, draw only non-animated tiles
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
    drawAnimations();
  }

  // Draw UI elements (combined into one function for side panel)
  drawScore();

  // Draw game over screen if applicable
  if (game.gameOver || game.won) {
    drawGameOver();
  }
}

// Game loop
function gameLoop(time) {
  const deltaTime = lastTime ? time - lastTime : 16;

  update(deltaTime);
  draw();

  lastTime = time;
  requestAnimationFrame(gameLoop);
}

// Initialize and start the game
initGame();
requestAnimationFrame(gameLoop);
