// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player state ===
let posX = 0;
let posY = 840; // Ground level (inverted Y-axis)
let posZ = 0;
let yaw = 0;
let pitch = 0;
const eyeHeight = 120; // Camera height above feet (in pixels)

// === Movement state ===
const keys = {};
const speed = 2;

// === Physics constants ===
const gravity = 1.5;
const jumpStrength = 70; // ~1 block height
const groundY = 840;

// Character vertical offset so feet align on ground
const characterYOffset = 50; // Move character model up by 50px

// Player vertical velocity and grounded state
let velY = 0;
let grounded = false;

// === Memoized transforms (for performance) ===
let lastSceneTransform = '';
let lastPlayerTransform = '';

// === Input handling ===
document.body.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && grounded) {
    velY = -jumpStrength; // Negative goes "up" (inverted Y-axis)
    grounded = false;
  }
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

  // Clamp pitch
  const maxPitch = 89;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;
}

// === Update position based on input + gravity + jump + collision ===
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

  // Gravity & jumping
  velY += gravity;
  posY += velY;

  // Ground collision
  if (posY > groundY) {
    posY = groundY;
    velY = 0;
    grounded = true;
  }
}

// === Apply transforms (3rd-person view) ===
function updateTransforms() {
  // Offset camera behind and above the player
  const cameraDistance = 200; // Distance behind player
  const cameraHeight = eyeHeight + 50; // Slightly above head
  const rad = yaw * (Math.PI / 180);

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

// === Helper: Create faces inside a block element ===
function createBlockFaces(block) {
  const faces = ['top', 'front', 'right', 'back', 'left', 'bottom'];
  faces.forEach(face => {
    const faceDiv = document.createElement('div');
    faceDiv.className = `face ${face}`;
    block.appendChild(faceDiv);
  });
}

// === Terrain generation ===
function generateFlatWorld() {
  const chunkSize = 10;
  const blockSize = 70;

  for (let x = 0; x < chunkSize; x++) {
    for (let z = 0; z < chunkSize; z++) {
      const block = document.createElement('div');
      block.className = 'grass block';
      const posX = x * blockSize;
      const posZ = z * blockSize;
      const posY = groundY;

      block.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
      createBlockFaces(block);
      world.appendChild(block);
    }
  }
}

// === Character creation (CSS-based) ===
function createCharacter() {
  playerModel.innerHTML = ''; // Clear previous

  const parts = [
    { className: 'torso' },
    { className: 'head' },
    { className: 'arm left' },
    { className: 'arm right' },
    { className: 'leg left' },
    { className: 'leg right' },
  ];

  parts.forEach(({ className }) => {
    const part = document.createElement('div');
    part.className = `part ${className}`;

    ['front', 'back', 'left', 'right', 'top', 'bottom'].forEach(face => {
      const faceDiv = document.createElement('div');
      faceDiv.className = `face ${face}`;
      part.appendChild(faceDiv);
    });

    playerModel.appendChild(part);
  });
}

// === Animation loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start game ===
generateFlatWorld();
createCharacter();
animate();
