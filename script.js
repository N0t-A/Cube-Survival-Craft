// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player state ===
let posX = 0;
let posY = -40; // Ground level (inverted Y-axis)
let posZ = 0;
let yaw = 0;
let pitch = 0;
const eyeHeight = 120; // Camera height above feet (pixels)

// === Movement state ===
const keys = {};
const speed = 2;

// === Memoized transforms for performance ===
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
  // Rotate and translate the whole scene (world)
  const sceneTransform = `
    rotateY(${yaw}deg)
    translate3d(${-posX}px, ${-posY}px, ${-posZ}px)
  `;

  // Apply transform if changed
  if (sceneTransform !== lastSceneTransform) {
    scene.style.transform = sceneTransform;
    lastSceneTransform = sceneTransform;
  }

  // Pitch only rotates cameraPitch wrapper (vertical look)
  cameraPitch.style.transform = `rotateX(${pitch}deg)`;

  // Player model position and yaw rotation for third person view
  const playerTransform = `
    translate3d(${posX}px, ${posY}px, ${posZ}px)
    rotateY(${yaw}deg)
  `;

  if (playerTransform !== lastPlayerTransform) {
    playerModel.style.transform = playerTransform;
    lastPlayerTransform = playerTransform;
  }

  // Position camera eye vertically (eyeHeight above feet)
  cameraEye.style.transform = `translate3d(0px, ${-(posY - eyeHeight)}px, 0px)`;
}

// === Dynamic terrain generation ===
function generateFlatWorld() {
  const chunkSize = 10;
  const blockSize = 70;
  const groundY = 0;
  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const block = document.createElement('div');
      block.className = 'block grass';
      const posX = x * blockSize;
      const posZ = z * blockSize;
      const posY = groundY;
      block.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
      world.appendChild(block);
    }
  }
}

// === Animation loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start the game ===
generateFlatWorld();
animate();
