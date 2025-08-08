// === Elements ===
const cameraPitch = document.getElementById('camera-pitch');
const cameraYaw = document.getElementById('camera-yaw');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player State ===
let posX = 0;
let posY = -40;  // Ground level
let posZ = 0;
let yaw = 0;
let pitch = 0;
const eyeHeight = 120;  // Camera height above feet

// === Movement ===
const keys = {};
const speed = 2;

// === Input Handling ===
document.body.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
document.body.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// === Pointer Lock + Mouse Look ===
document.body.addEventListener('click', () => document.body.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove);
  } else {
    document.removeEventListener('mousemove', onMouseMove);
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

// === Player Movement Update ===
function updatePlayerPosition() {
  let forward = 0, right = 0;
  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right += 1;
  if (keys['a']) right -= 1;

  const rad = yaw * Math.PI / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  posX += (forward * cos - right * sin) * speed;
  posZ += (forward * sin + right * cos) * speed;
}

// === Update Transforms ===
function updateTransforms() {
  // Rotate the world opposite to player's yaw and pitch (to simulate camera rotation)
  scene.style.transform = `
    rotateX(${-pitch}deg)
    rotateY(${-yaw}deg)
    translate3d(${-posX}px, ${-posY}px, ${-posZ}px)
  `;

  // Camera-eye position for eye height (fixed)
  cameraEye.style.transform = `translate3d(0px, ${-eyeHeight}px, 0px)`;
}

// === Generate Flat Terrain ===
function generateFlatWorld() {
  const chunkSize = 10;
  const blockSize = 70;
  const groundY = -40;

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const block = document.createElement('div');
      block.className = 'block grass-block'; // match CSS class if needed
      block.style.transform = `translate3d(${x * blockSize}px, ${groundY}px, ${z * blockSize}px)`;
      world.appendChild(block);
    }
  }
}

// === Animation Loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateFlatWorld();
animate();
