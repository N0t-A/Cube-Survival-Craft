// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

console.log('Script loaded. DOM refs ok?', !!world, !!scene, !!playerModel);

// === Config / constants ===
const BLOCK_SIZE = 70;                 // pixels per block
const CHUNK_SIZE = 10;                 // 10x10 chunk used in generation

// Base positions you had earlier (kept for reference)
const BASE_GROUND_Y = 1190;            // original groundY baseline (pixels)
const BASE_PLAYER_Y = 980;             // original player posY baseline (pixels)

// How many blocks to shift (user request)
/* Move grass down by 5 blocks, move player up by 7 blocks */
const GRASS_MOVE_DOWN_BLOCKS = 5;
const CHARACTER_MOVE_UP_BLOCKS = 7;

// compute actual positions in pixels from blocks
const groundY = BASE_GROUND_Y + GRASS_MOVE_DOWN_BLOCKS * BLOCK_SIZE;     // grass blocks Y
let posX = 0;
let posY = BASE_PLAYER_Y - CHARACTER_MOVE_UP_BLOCKS * BLOCK_SIZE;        // player Y (moved up)
let posZ = 0;

console.log('BLOCK_SIZE', BLOCK_SIZE, 'groundY', groundY, 'initial posY', posY);

let yaw = 0;
let pitch = 0;
const eyeHeight = 120; // camera eye offset

// Movement + physics
const keys = {};
const speed = 2;
const gravity = 1.5;       // positive moves down (inverted Y)
const jumpStrength = 70;   // how strong a jump is (pixels) — 70 is ~1 block

// character model offset — distance from posY to where model is drawn (feet vs model origin)
// Keep this as your model's designed offset. Modify if model appears misaligned.
let characterYOffset = 280; // existing value; you can tweak if required

// Player vertical state
let velY = 0;
let grounded = false;

// Memoized transforms
let lastSceneTransform = '';
let lastPlayerTransform = '';

// Map to track top surface Y for each grid cell (x,z) -> top Y in pixels
// key = `${gridX},${gridZ}`
const blockHeights = new Map();

// --- Input handlers ---
document.body.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && grounded) {
    velY = -jumpStrength; // negative goes 'up' in your inverted system
    grounded = false;
  }
});
document.body.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// pointer lock & mouse look
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove);
    console.log('pointer locked, mousemove attached');
  } else {
    document.removeEventListener('mousemove', onMouseMove);
    console.log('pointer unlocked, mousemove removed');
  }
});

function onMouseMove(e) {
  const sensitivity = 0.1;
  yaw += e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  const maxPitch = 89;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;
}

// --- Helper: create faces inside a block element ---
function createBlockFaces(block) {
  const faces = ['top', 'front', 'right', 'back', 'left', 'bottom'];
  faces.forEach(face => {
    const faceDiv = document.createElement('div');
    faceDiv.className = `face ${face}`;
    block.appendChild(faceDiv);
  });
}

// --- Terrain generation (flat chunk) ---
// This fills world div and populates blockHeights map
function generateFlatWorld() {
  world.innerHTML = '';            // clear existing to avoid duplicates
  blockHeights.clear();

  for (let gx = 0; gx < CHUNK_SIZE; gx++) {
    for (let gz = 0; gz < CHUNK_SIZE; gz++) {
      const block = document.createElement('div');
      block.className = 'grass block'; // CSS expects 'grass.block' styling
      const px = gx * BLOCK_SIZE;
      const pz = gz * BLOCK_SIZE;
      const py = groundY;             // top-surface Y of the grass block

      block.style.transform = `translate3d(${px}px, ${py}px, ${pz}px)`;
      createBlockFaces(block);
      world.appendChild(block);

      // store the top-surface Y for this grid cell
      blockHeights.set(`${gx},${gz}`, py);
    }
  }

  console.log('generateFlatWorld: placed', CHUNK_SIZE * CHUNK_SIZE, 'grass blocks');
  console.log('sample blockHeights[0,0] =', blockHeights.get('0,0'));
}

// --- Collision: find highest block surface under the player at their current posX,posZ ---
// returns topSurfaceY (pixels) or undefined if no block in that cell
function getBlockSurfaceAtPlayer() {
  // convert world coordinates to grid coordinates (integer cell)
  const gridX = Math.floor(posX / BLOCK_SIZE);
  const gridZ = Math.floor(posZ / BLOCK_SIZE);
  const key = `${gridX},${gridZ}`;
  return blockHeights.get(key);
}

// --- Update position (movement + gravity + collision) ---
function updatePlayerPosition() {
  // horizontal movement
  let forward = 0, right = 0;
  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right += 1;
  if (keys['a']) right -= 1;

  const rad = yaw * Math.PI / 180;
  const sin = Math.sin(rad), cos = Math.cos(rad);
  posX += (forward * cos - right * sin) * speed;
  posZ += (forward * sin + right * cos) * speed;

  // vertical (gravity)
  velY += gravity;
  posY += velY;

  // collision with actual block under player
  const surfaceY = getBlockSurfaceAtPlayer();

  // player's feet Y position in world coords
  const playerFeetY = posY - characterYOffset;

  if (surfaceY !== undefined) {
    // Because your Y is inverted (larger Y = lower on screen),
    // if playerFeetY is *less than* surfaceY, the feet are below the block top (fell through)
    if (playerFeetY < surfaceY) {
      // snap the player up so feet sit exactly at the surface
      posY = surfaceY + characterYOffset;
      velY = 0;
      grounded = true;
      // debug
      // console.log('snapped to block at', surfaceY, 'playerFeetY now', posY - characterYOffset);
    } else {
      grounded = false;
    }
  } else {
    // no block under player (outside chunk) => fallback floor collision
    if (posY > groundY) {
      posY = groundY;
      velY = 0;
      grounded = true;
    } else {
      grounded = false;
    }
  }
}

// --- Apply transforms (world rotates so camera feels like eyes) ---
function updateTransforms() {
  // camera positioned behind and above (3rd person for debugging)
  const cameraDistance = 200;
  const cameraHeight = eyeHeight + 50;
  const rad = yaw * Math.PI / 180;

  const camX = posX - Math.sin(rad) * cameraDistance;
  const camZ = posZ - Math.cos(rad) * cameraDistance;
  const camY = posY - cameraHeight;

  const sceneTransform = `
    rotateX(${pitch}deg)
    rotateY(${yaw}deg)
    translate3d(${-camX}px, ${-camY}px, ${-camZ}px)
  `;

  const playerTransform = `
    translate3d(${posX}px, ${posY - characterYOffset}px, ${posZ}px)
    rotateY(${yaw}deg)
  `;

  if (sceneTransform !== lastSceneTransform) {
    scene.style.transform = sceneTransform;
    lastSceneTransform = sceneTransform;
  }
  if (playerTransform !== lastPlayerTransform) {
    playerModel.style.transform = playerTransform;
    lastPlayerTransform = playerTransform;
  }
}

// --- Main loop ---
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateFlatWorld();
createCharacter();   // if you have this function defined elsewhere; otherwise createCharacter stub is fine
console.log('Starting game loop. posY =', posY, 'groundY =', groundY);
animate();
