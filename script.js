// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

const blockSize = 70;
const chunkSize = 16;
const eyeHeight = 120;
const groundLevel = -40;

let posX = 0;
let posY = groundLevel;
let posZ = 0;
let yaw = 0;
let pitch = 0;

let velocityY = 0;
let onGround = false;

const gravity = 1.5;
const jumpStrength = 30;
const moveSpeed = 10;

let keys = {};

// === Generate World ===
function generateChunk() {
  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const worldX = x * blockSize;
      const worldZ = z * blockSize;

      // Stone layer
      for (let y = 0; y < 5; y++) {
        const block = document.createElement('div');
        block.className = 'block stone';
        block.style.transform = `translate3d(${worldX}px, ${-y * blockSize}px, ${worldZ}px)`;
        world.appendChild(block);
      }

      // Dirt layer
      for (let y = 5; y < 6; y++) {
        const block = document.createElement('div');
        block.className = 'block dirt';
        block.style.transform = `translate3d(${worldX}px, ${-y * blockSize}px, ${worldZ}px)`;
        world.appendChild(block);
      }

      // Grass layer
      const grass = document.createElement('div');
      grass.className = 'block grass';
      grass.style.transform = `translate3d(${worldX}px, ${-6 * blockSize}px, ${worldZ}px)`;
      world.appendChild(grass);
    }
  }
}
generateChunk();

// === Update transforms ===
let lastSceneTransform = '';
let lastPlayerTransform = '';

function updateTransforms() {
  const sceneTransform = `
    rotateX(${pitch}deg)
    rotateY(${yaw}deg)
    translate3d(${-posX}px, ${-posY}px, ${-posZ}px)
  `;
  const playerTransform = `
    translate3d(${posX}px, ${posY}px, ${posZ}px)
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

  // ✅ FIX: Set camera-eye to world-relative height (Y axis is inverted)
  cameraEye.style.transform = `translate3d(0px, ${-(posY + eyeHeight)}px, 0px)`;
}

// === Handle input ===
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

function updatePlayerPosition() {
  // Movement direction
  let dx = 0;
  let dz = 0;

  if (keys['w']) dz -= 1;
  if (keys['s']) dz += 1;
  if (keys['a']) dx -= 1;
  if (keys['d']) dx += 1;

  const length = Math.hypot(dx, dz);
  if (length > 0) {
    dx /= length;
    dz /= length;

    const rad = yaw * Math.PI / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);

    posX += (dx * cos - dz * sin) * moveSpeed;
    posZ += (dx * sin + dz * cos) * moveSpeed;
  }

  // Jumping
  if (onGround && keys[' ']) {
    velocityY = -jumpStrength;
    onGround = false;
  }

  // Gravity
  velocityY += gravity;
  posY += velocityY;

  // Ground collision
  if (posY > groundLevel) {
    posY = groundLevel;
    velocityY = 0;
    onGround = true;
  }
}

// === Mouse look ===
let mouseLocked = false;

document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  mouseLocked = document.pointerLockElement === document.body;
});

document.addEventListener('mousemove', (e) => {
  if (!mouseLocked) return;
  yaw += e.movementX * 0.2;
  pitch -= e.movementY * 0.2;
  pitch = Math.max(-89, Math.min(89, pitch));
});

// === Game loop ===
function gameLoop() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(gameLoop);
}

gameLoop();
