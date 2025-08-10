// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

console.log('script start, DOM refs ok?', !!world, !!scene, !!playerModel);

// === Config / constants ===
const BLOCK_SIZE = 70;         // px per block
const CHUNK_SIZE_X = 10;       // width in blocks
const CHUNK_SIZE_Z = 10;       // depth in blocks
const STONE_LAYERS = 80;       // how many stone layers under the surface
const BASE_GROUND_Y = 1260;    // base pixel Y of the grass/top layer (your existing groundY)
const groundY = BASE_GROUND_Y; // top-surface Y of layer 0 (pixel)
const eyeHeight = 120;

// === Player state ===
let posX = 0;
let posY = groundY - 280; // default: place feet at ground (pixel) => posY = surface + character offset; we use offset below
let posZ = 0;
let yaw = 0, pitch = 0;

// character offset (distance from posY to where the model is drawn; adjust to fit CSS model)
const characterYOffset = 280; // pixels (so model origin is posY - characterYOffset)
posY = groundY + 0 * BLOCK_SIZE + characterYOffset; // ensure model starts standing on top layer

// === Movement / physics ===
const keys = {};
const speed = 2;
const gravity = 1.5;
const jumpStrength = 70;
let velY = 0;
let grounded = false;

// memoized transforms
let lastSceneTransform = '';
let lastPlayerTransform = '';

// === World data structure ===
// worldData keyed by "gx,gy,gz" where gx,gz in [0..CHUNK_SIZE-1], gy in [0..STONE_LAYERS-1]
// value is string: 'grass','dirt','stone','coal-ore', etc.
const worldData = new Map();

// helper to build map key
function keyAt(gx, gy, gz) { return `${gx},${gy},${gz}`; }

// === Input handling ===
document.body.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && grounded) {
    velY = -jumpStrength; // negative goes up in your inverted-y system
    grounded = false;
  }
});
document.body.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

// pointer lock + mouse look
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
}

// === Block DOM creation helpers ===
function createBlockElement(gx, gy, gz, type, exposedFaces) {
  const el = document.createElement('div');
  el.className = `block ${type}`; // e.g. "block grass" or "block coal-ore"
  const px = gx * BLOCK_SIZE;
  const pz = gz * BLOCK_SIZE;
  const py = groundY + gy * BLOCK_SIZE; // pixel Y (inverted axis: larger Y = lower on screen)
  el.style.transform = `translate3d(${px}px, ${py}px, ${pz}px)`;

  for (const face of exposedFaces) {
    const faceEl = document.createElement('div');
    faceEl.className = `face ${face}`;
    el.appendChild(faceEl);
  }
  return el;
}

// === Face culling: check neighbor existence in worldData by grid coords
function getExposedFacesFor(gx, gy, gz) {
  const neighbors = [
    {dx: 0, dy: -1, dz: 0, name: 'top'},     // above in grid (smaller pixel Y)
    {dx: 0, dy: 1, dz: 0, name: 'bottom'},   // below
    {dx: 0, dy: 0, dz: -1, name: 'front'},
    {dx: 0, dy: 0, dz: 1, name: 'back'},
    {dx: -1, dy: 0, dz: 0, name: 'left'},
    {dx: 1, dy: 0, dz: 0, name: 'right'},
  ];
  const faces = [];
  for (const n of neighbors) {
    const nk = keyAt(gx + n.dx, gy + n.dy, gz + n.dz);
    if (!worldData.has(nk)) faces.push(n.name);
  }
  return faces;
}

// === Ore vein generator (random-walk)
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

    // only replace stone positions (so we don't overwrite grass/dirt)
    const existing = worldData.get(k);
    if (existing === 'stone') {
      worldData.set(k, type);
      placed.push({x: cur.x, y: cur.y, z: cur.z});
    }

    // push neighbors with some bias
    const neighbors = [
      {x:cur.x+1,y:cur.y,z:cur.z},
      {x:cur.x-1,y:cur.y,z:cur.z},
      {x:cur.x,y:cur.y+1,z:cur.z},
      {x:cur.x,y:cur.y-1,z:cur.z},
      {x:cur.x,y:cur.y,z:cur.z+1},
      {x:cur.x,y:cur.y,z:cur.z-1},
    ];
    for (const n of neighbors) {
      // bounds check
      if (n.x < 0 || n.x >= CHUNK_SIZE_X || n.z < 0 || n.z >= CHUNK_SIZE_Z || n.y < 0 || n.y >= STONE_LAYERS) continue;
      if (!visited.has(keyAt(n.x,n.y,n.z)) && Math.random() < 0.9) {
        stack.push(n);
      }
    }
  }
  return placed;
}

// === Full multi-layer terrain generation (replaces generateFlatWorld) ===
function generateMultiLayerWorld() {
  world.innerHTML = '';
  worldData.clear();

  const chunkX = CHUNK_SIZE_X;
  const chunkZ = CHUNK_SIZE_Z;

  // For each column (gx,gz) generate top grass, random 2-3 dirt layers, then stone down to STONE_LAYERS
  for (let gx = 0; gx < chunkX; gx++) {
    for (let gz = 0; gz < chunkZ; gz++) {
      const dirtLayers = Math.floor(Math.random() * 2) + 2; // 2 or 3
      // layer 0 = grass
      worldData.set(keyAt(gx, 0, gz), 'grass');

      // dirt layers 1..dirtLayers
      for (let y = 1; y <= dirtLayers; y++) {
        worldData.set(keyAt(gx, y, gz), 'dirt');
      }

      // stone layers from dirtLayers+1 up to STONE_LAYERS-1
      for (let y = dirtLayers + 1; y < STONE_LAYERS; y++) {
        worldData.set(keyAt(gx, y, gz), 'stone');
      }
    }
  }

  // --- ORE GENERATION PARAMETERS (grid layer indices) ---
  const ores = [
    { name: 'coal-ore',   minD: 1,  maxD: 15, veins: 2, size: 15 },
    { name: 'copper-ore', minD: 10, maxD: 20, veins: 2, size: 10 },
    { name: 'tin-ore',    minD: 10, maxD: 20, veins: 2, size: 10 },
    { name: 'iron-ore',   minD: 20, maxD: 35, veins: 2, size: 7  },
    { name: 'diamond-ore',minD: 35, maxD: 50, veins: 1, size: 4  },
    { name: 'amber-ore',  minD: 50, maxD: 80, veins: 1, size: 1  },
    { name: 'ruby-ore',   minD: 50, maxD: 80, veins: 1, size: 1  },
  ];

  // generate veins for each ore in order (higher-priority ores later to override)
  for (const ore of ores) {
    for (let v = 0; v < ore.veins; v++) {
      // choose random starting position within chunk and depth range
      const gx = Math.floor(Math.random() * chunkX);
      const gz = Math.floor(Math.random() * chunkZ);
      // clamp depth to bounds and STONE_LAYERS
      const minLayer = Math.max(1, ore.minD);
      const maxLayer = Math.min(STONE_LAYERS - 1, ore.maxD);
      if (minLayer > maxLayer) continue;
      const gy = Math.floor(minLayer + Math.random() * (maxLayer - minLayer + 1));
      // create vein by random walk
      generateVein(gx, gy, gz, ore.size, ore.name);
    }
  }

  // --- Create DOM blocks but only for exposed faces ---
  let created = 0;
  for (const [k, type] of worldData.entries()) {
    // parse coords
    const [gx, gy, gz] = k.split(',').map(Number);
    const exposed = getExposedFacesFor(gx, gy, gz);
    if (exposed.length === 0) continue; // fully enclosed, skip creating DOM element
    const el = createBlockElement(gx, gy, gz, type, exposed);
    world.appendChild(el);
    created++;
  }

  console.log('generateMultiLayerWorld: worldData size', worldData.size, 'created DOM blocks', created);
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

// === Collision helper: get highest block top surface under player's grid cell
function getTopSurfaceYUnderPlayer() {
  const gx = Math.floor(posX / BLOCK_SIZE);
  const gz = Math.floor(posZ / BLOCK_SIZE);
  // iterate layers from top (0) downwards to find the first existing block
  for (let gy = 0; gy < STONE_LAYERS; gy++) {
    if (worldData.has(keyAt(gx, gy, gz))) {
      // pixel Y of that layer's top surface (we treat block at layer gy as occupying its top)
      return groundY + gy * BLOCK_SIZE;
    }
  }
  return undefined;
}

// === Movement & collision update (uses block-based surface check) ===
function updatePlayerPosition() {
  // horizontal movement
  let forward = 0, right = 0;
  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right += 1;
  if (keys['a']) right -= 1;
  const rad = yaw * Math.PI / 180;
  posX += (forward * Math.cos(rad) - right * Math.sin(rad)) * speed;
  posZ += (forward * Math.sin(rad) + right * Math.cos(rad)) * speed;

  // vertical
  velY += gravity;
  posY += velY;

  // check block under player's grid cell
  const surface = getTopSurfaceYUnderPlayer();
  const playerFeetY = posY - characterYOffset;

  if (surface !== undefined) {
    if (playerFeetY > surface) {
      posY = surface + characterYOffset;
      velY = 0;
      grounded = true;
    } else {
      grounded = false;
    }
  } else {
    // fallback clamp in case no blocks under player
    if (posY > groundY + STONE_LAYERS * BLOCK_SIZE) {
      posY = groundY + STONE_LAYERS * BLOCK_SIZE;
      velY = 0;
      grounded = true;
    } else {
      grounded = false;
    }
  }
}

// === Transforms ===
function updateTransforms() {
  const cameraDistance = 200;
  const cameraHeight = eyeHeight + 50;
  const rad = yaw * Math.PI / 180;
  const camX = posX - Math.sin(rad) * cameraDistance;
  const camZ = posZ - Math.cos(rad) * cameraDistance;

  // Correct camY for inverted Y axis (subtract to go *up*)
  const camY = posY - cameraHeight;

  // Debug info to console:
  console.log(`posY: ${posY}, cameraHeight: ${cameraHeight}, camY: ${camY}`);

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

// === Game loop ===
function animate() {
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateMultiLayerWorld();
createCharacter();
console.log('World generated. posY start:', posY, 'groundY:', groundY);
animate();
