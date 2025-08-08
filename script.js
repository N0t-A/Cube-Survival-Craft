// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// Debugging: Check if 'world' element is found
console.log('world div:', world);

if (!world) {
  console.error('Error: world element not found!');
}

// === Player state ===
let posX = 0;
let posY = -40; // Ground level (inverted Y-axis)
let posZ = 0;
let yaw = 0;
let pitch = 0;
const eyeHeight = 120; // Camera height above feet (in pixels)

// === Movement state ===
const keys = {};
const speed = 2;

// === Memoized transforms (for performance) ===
let lastSceneTransform = '';
let lastPlayerTransform = '';

// === Input handling ===
document.body.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
document.body.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// === Pointer lock + mouse look ===
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

function onMouseMove(e) {
  const sensitivity = 0.1;
  yaw += e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;

  // Clamp pitch to avoid flipping
  const maxPitch = 89;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;
}

// === Update position based on input ===
function updatePlayerPosition() {
  let forward = 0;
  let right = 0;

  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right += 1;
  if (keys['a']) right -= 1;

  const rad = yaw * (Math.PI / 180);
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  posX += (forward * cos - right * sin) * speed;
  posZ += (forward * sin + right * cos) * speed;
}

// === Apply transforms to DOM ===
function updateTransforms() {
  // Rotate the world to simulate camera rotation
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

  // Camera eye stays fixed (eyes of player)
  cameraEye.style.transform = `translate3d(0px, ${-eyeHeight}px, 0px)`;
}

// === Terrain generation ===
function generateFlatWorld() {
  const chunkSize = 10;
  const blockSize = 70;
  const groundY = -40; // Ground level to align with player posY

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const block = document.createElement('div');
      block.className = 'grass block';
      const posX = x * blockSize;
      const posZ = z * blockSize;
      const posY = groundY;
      block.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
      world.appendChild(block);
    }
  }
  console.log(`Generated ${chunkSize * chunkSize} blocks in world div.`);
}

// === Animation loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start game ===
generateFlatWorld();
animate();
