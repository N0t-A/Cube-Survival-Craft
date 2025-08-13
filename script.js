console.log('script running');

const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Config / constants ===
const BLOCK_SIZE = 70;         // px per block
const CHUNK_SIZE_X = 10;       // width in blocks
const CHUNK_SIZE_Z = 10;       // depth in blocks
const STONE_LAYERS = 80;       // how many stone layers under the surface (gy: 0 .. STONE_LAYERS-1)
const GROUND_LAYER = 0;        // top surface layer index
const eyeHeightPx = 120;       // camera offset above the character origin (in px)

// ===== Player state in BLOCKS (not pixels) =====
// posY is FEET elevation in blocks. Ground surface is layer 0 => feet at 0 when standing on grass.
let posX = 0;     // blocks
let posY = 0;     // feet Y in blocks (0 = top grass surface)
let posZ = 0;     // blocks
let yaw = 0, pitch = 0;

// character model origin is characterYOffset above feet; keep it in BLOCKS
const characterYOffsetBlocks = 280 / BLOCK_SIZE; // 280px -> 4 blocks
// === Movement / physics (in BLOCKS/frame) ===
const keys = {};
const speedBlocks = (2 / BLOCK_SIZE);      // 2px per frame -> ~0.0286 blocks/frame
const gravityBlocks = (1.5 / BLOCK_SIZE);  // 1.5px/frame^2 -> ~0.0214 blocks/frame^2 (positive pulls down)
const jumpBlocks = (70 / BLOCK_SIZE);      // 70px -> 1 block
let velY = 0;       // blocks/frame
let grounded = false;

// memoized transforms
let lastSceneTransform = '';
let lastPlayerTransform = '';

// === World data structure ===
// key: "gx,gy,gz" -> value: 'grass' | 'dirt' | 'stone' | 'coal-ore' | ...
const worldData = new Map();
const keyAt = (gx, gy, gz) => `${gx},${gy},${gz}`;

// === Input handling ===
document.body.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && grounded) {
    velY = -jumpBlocks; // negative moves up (since increasing Y is downwards)
    grounded = false;
  }
});
document.body.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// === Pointer lock + mouse look (with logging) ===
document.body.addEventListener('click', () => {
  document.body.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === document.body) {
    document.addEventListener('mousemove', onMouseMove);
    console.log('pointer lock ON');
  } else {
    document.removeEventListener('mousemove', onMouseMove);
    console.log('pointer lock OFF');
  }
});
function onMouseMove(e) {
  const sensitivity = 0.1;
  yaw += e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  const maxPitch = 89;
  if (pitch > maxPitch) pitch = maxPitch;
  if (pitch < -maxPitch) pitch = -maxPitch;
  // occasional log to avoid spam
  if ((performance.now()|0) % 200 < 16) {
    console.log(`View yaw: ${yaw.toFixed(2)}°, pitch: ${pitch.toFixed(2)}°`);
  }
}

// === Block DOM creation helpers ===
function createBlockElement(gx, gy, gz, type, exposedFaces) {
  const el = document.createElement('div');
  el.className = `block ${type}`;
  const px = gx * BLOCK_SIZE;
  const pz = gz * BLOCK_SIZE;
  const py = gy * BLOCK_SIZE; // ground is layer 0 -> y = 0px
  el.style.transform = `translate3d(${px}px, ${py}px, ${pz}px)`;

  for (const face of exposedFaces) {
    const faceEl = document.createElement('div');
    faceEl.className = `face ${face}`;
    el.appendChild(faceEl);
  }
  return el;
}

// === Face culling ===
function getExposedFacesFor(gx, gy, gz) {
  const neighbors = [
    {dx: 0, dy: -1, dz: 0, name: 'top'},     // above (smaller Y layer)
    {dx: 0, dy:  1, dz: 0, name: 'bottom'},  // below
    {dx: 0, dy:  0, dz:-1, name: 'front'},
    {dx: 0, dy:  0, dz: 1, name: 'back'},
    {dx:-1, dy:  0, dz: 0, name: 'left'},
    {dx: 1, dy:  0, dz: 0, name: 'right'},
  ];
  const faces = [];
  for (const n of neighbors) {
    const nk = keyAt(gx + n.dx, gy + n.dy, gz + n.dz);
    if (!worldData.has(nk)) faces.push(n.name);
  }
  return faces;
}

// === Ore vein generator (random-walk) ===
function generateVein(startGX, startGY, startGZ, size, type) {
  const placed = [];
  const stack = [{x: startGX, y: startGY, z: startGZ}];
  const visited = new Set();
  while (stack.length > 0 && placed.length < size) {
    const idx = Math.floor(Math.random() * stack.length);
    const cur = stack.splice(idx,1)[0];
    const k = keyAt(cur.x, cur.y, cur.z);
    if (visited.has(k)) continue;
    visited.add(k);

    if (worldData.get(k) === 'stone') {
      worldData.set(k, type);
      placed.push({x: cur.x, y: cur.y, z: cur.z});
    }

    const neighbors = [
      {x:cur.x+1,y:cur.y,z:cur.z},
      {x:cur.x-1,y:cur.y,z:cur.z},
      {x:cur.x,y:cur.y+1,z:cur.z},
      {x:cur.x,y:cur.y-1,z:cur.z},
      {x:cur.x,y:cur.y,z:cur.z+1},
      {x:cur.x,y:cur.y,z:cur.z-1},
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= CHUNK_SIZE_X || n.z < 0 || n.z >= CHUNK_SIZE_Z || n.y < 0 || n.y >= STONE_LAYERS) continue;
      if (!visited.has(keyAt(n.x,n.y,n.z)) && Math.random() < 0.9) {
        stack.push(n);
      }
    }
  }
  return placed;
}

// === Full multi-layer terrain generation ===
function generateMultiLayerWorld() {
  world.innerHTML = '';
  worldData.clear();

  for (let gx = 0; gx < CHUNK_SIZE_X; gx++) {
    for (let gz = 0; gz < CHUNK_SIZE_Z; gz++) {
      const dirtLayers = Math.floor(Math.random() * 2) + 2; // 2 or 3 dirt layers
      worldData.set(keyAt(gx, 0, gz), 'grass');
      for (let y = 1; y <= dirtLayers; y++) worldData.set(keyAt(gx, y, gz), 'dirt');
      for (let y = dirtLayers + 1; y < STONE_LAYERS; y++) worldData.set(keyAt(gx, y, gz), 'stone');
    }
  }

  const ores = [
    { name: 'coal-ore',    minD: 1,  maxD: 15, veins: 2, size: 15 },
    { name: 'copper-ore',  minD: 10, maxD: 20, veins: 2, size: 10 },
    { name: 'tin-ore',     minD: 10, maxD: 20, veins: 2, size: 10 },
    { name: 'iron-ore',    minD: 20, maxD: 35, veins: 2, size: 7  },
    { name: 'diamond-ore', minD: 35, maxD: 50, veins: 1, size: 4  },
    { name: 'amber-ore',   minD: 50, maxD: 80, veins: 1, size: 1  },
    { name: 'ruby-ore',    minD: 50, maxD: 80, veins: 1, size: 1  },
  ];

  for (const ore of ores) {
    for (let v = 0; v < ore.veins; v++) {
      const gx = Math.floor(Math.random() * CHUNK_SIZE_X);
      const gz = Math.floor(Math.random() * CHUNK_SIZE_Z);
      const minLayer = Math.max(1, ore.minD);
      const maxLayer = Math.min(STONE_LAYERS - 1, ore.maxD);
      if (minLayer > maxLayer) continue;
      const gy = Math.floor(minLayer + Math.random() * (maxLayer - minLayer + 1));
      generateVein(gx, gy, gz, ore.size, ore.name);
    }
  }

  let created = 0;
  for (const [k, type] of worldData.entries()) {
    const [gx, gy, gz] = k.split(',').map(Number);
    const exposed = getExposedFacesFor(gx, gy, gz);
    if (exposed.length === 0) continue;
    world.appendChild(createBlockElement(gx, gy, gz, type, exposed));
    created++;
  }

  console.log('generateMultiLayerWorld: worldData size', worldData.size, 'created DOM blocks', created);
}

// === Character creation (CSS-based) ===
function createCharacter() {
  playerModel.innerHTML = '';

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

// === Collision helper: highest block top surface under player (in BLOCKS) ===
function getTopSurfaceLayerUnderPlayer() {
  const gx = Math.floor(posX);
  const gz = Math.floor(posZ);
  if (gx < 0 || gx >= CHUNK_SIZE_X || gz < 0 || gz >= CHUNK_SIZE_Z) return undefined;
  for (let gy = 0; gy < STONE_LAYERS; gy++) {
    if (worldData.has(keyAt(gx, gy, gz))) {
      return gy; // layer index == top surface Y in blocks
    }
  }
  return undefined;
}

// === Movement & collision update (all in BLOCKS) ===
function updatePlayerPosition() {
  // Horizontal input (in blocks)
  let forward = 0, right = 0;
  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right   += 1;
  if (keys['a']) right   -= 1;

  const rad = yaw * Math.PI / 180;
  posX += (forward * Math.cos(rad) - right * Math.sin(rad)) * speedBlocks;
  posZ += (forward * Math.sin(rad) + right * Math.cos(rad)) * speedBlocks;

  // Vertical physics
  velY += gravityBlocks;  // positive pulls down (increasing blocks)
  posY += velY;

  // Collision with terrain column under player
  const surfaceLayer = getTopSurfaceLayerUnderPlayer();
  const feetY = posY; // feet elevation in blocks

  if (surfaceLayer !== undefined) {
    if (feetY > surfaceLayer) {
      // feet went into ground -> snap on top
      posY = surfaceLayer;
      velY = 0;
      grounded = true;
    } else {
      grounded = false;
    }
  } else {
    grounded = false; // outside chunk columns -> no ground here
  }
}

// === Transforms (convert BLOCKS -> PIXELS) ===
function updateTransforms() {
  // Player model origin is characterYOffsetBlocks above feet
  const pxX = posX * BLOCK_SIZE;
  const pxY = (posY - characterYOffsetBlocks) * BLOCK_SIZE;
  const pxZ = posZ * BLOCK_SIZE;

  // 3rd-person camera
  const cameraDistancePx = 200; // px behind player
  const cameraHeightPx = eyeHeightPx + (characterYOffsetBlocks * BLOCK_SIZE);
  const rad = yaw * Math.PI / 180;
  const camX = pxX - Math.sin(rad) * cameraDistancePx;
  const camZ = pxZ - Math.cos(rad) * cameraDistancePx;
  const camY = (posY * BLOCK_SIZE) - cameraHeightPx;

  // Debug logs
  // Feet elevation in px == posY * 70; should be 0 when standing on grass
  const elevationPx = posY * BLOCK_SIZE;
  console.log(`Feet elevation: ${elevationPx.toFixed(2)}px (${posY.toFixed(3)} blocks)`);

  const sceneTransform = `
    rotateX(${pitch}deg)
    rotateY(${yaw}deg)
    translate3d(${-camX}px, ${-camY}px, ${-camZ}px)
  `;
  const playerTransform = `
    translate3d(${pxX}px, ${pxY}px, ${pxZ}px)
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

// === Game loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateMultiLayerWorld();
createCharacter();

// Spawn player ON the surface to avoid initial sinking (posY = surface layer)
const spawnSurface = getTopSurfaceLayerUnderPlayer() ?? GROUND_LAYER;
posY = spawnSurface;   // feet at surface layer (== 0 for grass)
// start at rest
velY = 0;
grounded = true;

console.log('World generated. Starting feet (blocks):', posY, 'expect 0 on grass.');
animate();
