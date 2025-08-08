// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Pointer Lock ===
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove);
  } else {
    document.removeEventListener('mousemove', onMouseMove);
  }
});

// === Camera rotation ===
let yaw = 0;
let pitch = 0;

function onMouseMove(e) {
  yaw -= e.movementX * 0.1;
  pitch -= e.movementY * 0.1;
  pitch = Math.max(-90, Math.min(90, pitch));

  // Apply rotation
  cameraYaw.style.transform = `rotateY(${yaw}deg)`;
  cameraPitch.style.transform = `rotateX(${pitch}deg)`;
}

// === Player position ===
let posX = 0;
let posY = -40; // Ground level (inverted Y-axis: smaller values are higher)
let posZ = 0;
const eyeHeight = 120;

function updateCameraPosition() {
  // Adjust for inverted Y-axis
  cameraEye.style.transform = `translate3d(${posX}px, ${-(posY - eyeHeight)}px, ${posZ}px)`;
}

// === Block creation ===
function createBlock(type, x, y, z) {
  const block = document.createElement('div');
  block.className = `${type} block`;
  block.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;

  const faces = ['top', 'front', 'right', 'back', 'left', 'bottom'];
  for (const face of faces) {
    const faceDiv = document.createElement('div');
    faceDiv.className = `face ${face}`;
    block.appendChild(faceDiv);
  }

  return block;
}

// === Terrain generation ===
function generateTerrain() {
  const chunkSize = 10; // 10x10 blocks
  const blockSize = 70;
  const groundLevel = -40;

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      // Grass block at ground level
      let block = createBlock('grass', x * blockSize, groundLevel, z * blockSize);
      world.appendChild(block);

      // Dirt blocks below grass
      for (let y = 1; y <= 3; y++) {
        let dirtY = groundLevel + (blockSize * y); // goes downward
        block = createBlock('dirt', x * blockSize, dirtY, z * blockSize);
        world.appendChild(block);
      }
    }
  }
}

// === Game loop ===
function gameLoop() {
  updateCameraPosition();
  requestAnimationFrame(gameLoop);
}

// === Init ===
generateTerrain();
gameLoop();
