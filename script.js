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

// === Camera control ===
let yaw = 0;
let pitch = 0;

function onMouseMove(e) {
  yaw -= e.movementX * 0.1;
  pitch -= e.movementY * 0.1;
  pitch = Math.max(-90, Math.min(90, pitch));

  cameraYaw.style.transform = `rotateY(${yaw}deg)`;
  cameraPitch.style.transform = `rotateX(${pitch}deg)`;
}

// === Player position ===
let posX = 0;
let posY = -40; // Ground level
let posZ = 0;
const eyeHeight = 120;

function updateCameraPosition() {
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
      const height = 3; // top layer + dirt

      for (let y = 0; y < height; y++) {
        let type;
        if (y === 0) {
          type = 'grass';
        } else {
          type = 'dirt';
        }

        const block = createBlock(
          type,
          x * blockSize,
          groundLevel - (y * blockSize),
          z * blockSize
        );

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
