// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

const playerHeight = 130;
const eyeHeight = 680; // ⬅️ Fixed: raised camera by 8 blocks (560px)

let yaw = 0, pitch = 0;
let targetYaw = 0, targetPitch = 0;
const mouseSensitivity = 0.1;

let posX = 0;
let posY = 0;
let posZ = 0;
let velocityY = 0;
const gravity = 0.5;
const groundLevel = 0;

const jumpHeight = 70;
const jumpVelocity = -Math.sqrt(2 * gravity * jumpHeight);

let keysPressed = {};

const chunkSize = 10;
const blockSize = 70;
const renderDistance = 1;

const loadedChunks = new Set();
let chunkQueue = [];

let lastChunkX = null;
let lastChunkZ = null;

let lastSceneTransform = '';
let lastPlayerTransform = '';

// === Pointer lock ===
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    console.log('✅ Pointer lock enabled');
  }
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === document.body) {
    targetYaw += e.movementX * mouseSensitivity;
    targetPitch -= e.movementY * mouseSensitivity;
    targetPitch = Math.max(-85, Math.min(85, targetPitch));
  }
});

document.addEventListener('keydown', (e) => {
  keysPressed[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && posY === groundLevel) {
    velocityY = jumpVelocity;
    e.preventDefault();
  }
  if (e.key.toLowerCase() === 'e') {
    document.getElementById('inventory-panel').classList.toggle('hidden');
    updateInventoryUI();
  }
});

document.addEventListener('keyup', (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// === Block generation ===
function createBlock(x, y, z, type, exposedFaces) {
  const block = document.createElement('div');
  block.className = `block ${type}`;
  block.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;

  for (const face of exposedFaces) {
    const faceEl = document.createElement('div');
    faceEl.classList.add('face', face);
    block.appendChild(faceEl);
  }

  return block;
}

function placeOreVein(blocks, x, y, z, type, size) {
  for (let i = 0; i < size; i++) {
    const dx = x + (Math.floor(Math.random() * 3) - 1) * blockSize;
    const dy = y + (Math.floor(Math.random() * 3) - 1) * blockSize;
    const dz = z + (Math.floor(Math.random() * 3) - 1) * blockSize;
    const key = `${dx},${dy},${dz}`;
    blocks[key] = type;
  }
}

function generateChunk(chunkX, chunkZ) {
  const chunkKey = `${chunkX},${chunkZ}`;
  if (loadedChunks.has(chunkKey)) return;

  const startX = chunkX * chunkSize * blockSize;
  const startZ = chunkZ * chunkSize * blockSize;
  const blocks = {};
  const dirtHeight = blockSize - 30;

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const worldX = startX + x * blockSize;
      const worldZ = startZ + z * blockSize;

      const grassY = -dirtHeight;
      blocks[`${worldX},${grassY},${worldZ}`] = 'grass';

      const dirtLayers = Math.floor(Math.random() * 2) + 2;
      for (let i = 1; i <= dirtLayers; i++) {
        const y = grassY + i * blockSize;
        blocks[`${worldX},${y},${worldZ}`] = 'dirt';
      }

      for (let i = dirtLayers + 1; i <= 80; i++) {
        const y = grassY + i * blockSize;
        blocks[`${worldX},${y},${worldZ}`] = 'stone';
      }
    }
  }

  const ores = [
    { type: 'coal', min: 1, max: 25, veins: 3, size: 7 },
    { type: 'copper', min: 15, max: 30, veins: 2, size: 5 },
    { type: 'tin', min: 15, max: 30, veins: 2, size: 5 },
    { type: 'iron', min: 25, max: 50, veins: 4, size: 8 },
    { type: 'diamond', min: 40, max: 60, veins: 2, size: 4 },
    { type: 'ruby', min: 70, max: 80, veins: 1, size: 1 },
    { type: 'amber', min: 70, max: 80, veins: 1, size: 1 }
  ];

  for (const ore of ores) {
    for (let i = 0; i < ore.veins; i++) {
      const rx = startX + Math.floor(Math.random() * chunkSize) * blockSize;
      const rz = startZ + Math.floor(Math.random() * chunkSize) * blockSize;
      const ry = -dirtHeight + Math.floor(ore.min + Math.random() * (ore.max - ore.min)) * blockSize;
      placeOreVein(blocks, rx, ry, rz, ore.type, ore.size);
    }
  }

  const fragment = document.createDocumentFragment();
  const directions = [
    [ 0, -blockSize,  0, 'top'    ],
    [-blockSize, 0,  0, 'left'   ],
    [ blockSize, 0,  0, 'right'  ],
    [ 0, 0, -blockSize, 'front' ],
    [ 0, 0,  blockSize, 'back'  ],
    [ 0,  blockSize, 0, 'bottom' ]
  ];

  for (const [key, type] of Object.entries(blocks)) {
    const [x, y, z] = key.split(',').map(Number);
    const exposedFaces = [];

    for (const [dx, dy, dz, faceName] of directions) {
      const neighborKey = `${x + dx},${y + dy},${z + dz}`;
      if (!blocks.hasOwnProperty(neighborKey)) {
        exposedFaces.push(faceName);
      }
    }

    if (exposedFaces.length > 0) {
      fragment.appendChild(createBlock(x, y, z, type, exposedFaces));
    }
  }

  world.appendChild(fragment);
  loadedChunks.add(chunkKey);
}

function loadChunksAroundPlayer() {
  const playerChunkX = Math.floor(posX / (chunkSize * blockSize));
  const playerChunkZ = Math.floor(posZ / (chunkSize * blockSize));

  if (playerChunkX === lastChunkX && playerChunkZ === lastChunkZ) return;
  lastChunkX = playerChunkX;
  lastChunkZ = playerChunkZ;

  for (let dx = -renderDistance; dx <= renderDistance; dx++) {
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      const cx = playerChunkX + dx;
      const cz = playerChunkZ + dz;
      const chunkKey = `${cx},${cz}`;
      if (!loadedChunks.has(chunkKey)) {
        chunkQueue.push({ x: cx, z: cz });
      }
    }
  }
}

function processChunkQueue() {
  const maxPerFrame = 1;
  const startTime = performance.now();
  const timeLimit = 8;

  let i = 0;
  while (i < maxPerFrame && chunkQueue.length > 0) {
    const { x, z } = chunkQueue.shift();
    generateChunk(x, z);
    i++;
  }

  while (performance.now() - startTime < timeLimit && chunkQueue.length > 0) {
    const { x, z } = chunkQueue.shift();
    generateChunk(x, z);
  }
}

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

  cameraEye.style.transform = `translateY(${eyeHeight}px)`; // ✅ Raised camera
}

function animate() {
  yaw = lerp(yaw, targetYaw, 0.1);
  pitch = lerp(pitch, targetPitch, 0.1);

  velocityY += gravity;
  posY += velocityY;
  if (posY > groundLevel) {
    posY = groundLevel;
    velocityY = 0;
  }

  const speed = 3;
  let moveX = 0;
  let moveZ = 0;
  if (keysPressed['w']) moveZ += 1;
  if (keysPressed['s']) moveZ -= 1;
  if (keysPressed['a']) moveX -= 1;
  if (keysPressed['d']) moveX += 1;

  if (moveX !== 0 && moveZ !== 0) {
    moveX *= Math.SQRT1_2;
    moveZ *= Math.SQRT1_2;
  }

  const yawRad = yaw * Math.PI / 180;
  const forwardX = Math.sin(yawRad);
  const forwardZ = -Math.cos(yawRad);
  const rightX = Math.sin(yawRad + Math.PI / 2);
  const rightZ = -Math.cos(yawRad + Math.PI / 2);

  posX += (forwardX * moveZ + rightX * moveX) * speed;
  posZ += (forwardZ * moveZ + rightZ * moveX) * speed;

  loadChunksAroundPlayer();
  processChunkQueue();
  updateTransforms();

  requestAnimationFrame(animate);
}

// === Inventory ===
const hotbar = new Array(9).fill(null);
const fullInventory = new Array(27).fill(null);

function updateInventoryUI() {
  document.querySelectorAll('#inventory .slot').forEach((slot, i) => {
    slot.className = 'slot';
    if (hotbar[i]) slot.classList.add(hotbar[i].name);
  });
  document.querySelectorAll('#inventory-panel .slot').forEach((slot, i) => {
    slot.className = 'slot';
    if (fullInventory[i]) slot.classList.add(fullInventory[i].name);
  });
}

hotbar[0] = { name: 'dirt' };
fullInventory[0] = { name: 'grass' };
fullInventory[1] = { name: 'stone' };
fullInventory[2] = { name: 'coal' };
fullInventory[3] = { name: 'copper' };
fullInventory[4] = { name: 'tin' };
fullInventory[5] = { name: 'iron' };
fullInventory[6] = { name: 'diamond' };
fullInventory[7] = { name: 'ruby' };
fullInventory[8] = { name: 'amber' };

updateInventoryUI();
animate();
