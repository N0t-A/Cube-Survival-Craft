// === Game Setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player Position & Camera Settings ===
let posX = 0;
let posY = -40; // Ground level feet position
let posZ = 0;
const eyeHeight = 120; // Camera eye height in px

let yaw = 0;
let pitch = 0;

// === Pointer Lock Setup ===
document.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove);
  } else {
    document.removeEventListener('mousemove', onMouseMove);
  }
});

function onMouseMove(e) {
  yaw -= e.movementX * 0.1;
  pitch -= e.movementY * 0.1;
  pitch = Math.max(-90, Math.min(90, pitch));

  cameraYaw.style.transform = `rotateY(${yaw}deg)`;
  cameraPitch.style.transform = `rotateX(${pitch}deg)`;
}

// === Camera Position Update ===
function updateCameraPosition() {
  cameraEye.style.transform = `translate3d(${posX}px, ${-(posY + eyeHeight)}px, ${posZ}px)`;
}

// === Block Creation ===
function createBlock(type, x, y, z) {
  const block = document.createElement('div');
  block.className = `${type} block`;
  block.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;

  const faces = ['top', 'bottom', 'left', 'right', 'front', 'back'];
  faces.forEach(faceName => {
    const face = document.createElement('div');
    face.className = `face ${faceName}`;
    block.appendChild(face);
  });

  world.appendChild(block);
}

// === Dynamic Terrain Generation ===
function generateTerrain(width, depth, height) {
  const blockSize = 70;

  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      // Grass block at surface
      createBlock('grass', x * blockSize, posY, z * blockSize);

      // Dirt layer below grass
      for (let dy = 1; dy <= height; dy++) {
        createBlock('dirt', x * blockSize, posY + (dy * blockSize), z * blockSize);
      }
    }
  }
}

// === Init ===
generateTerrain(10, 10, 3); // Width, Depth, Dirt depth
updateCameraPosition();
