console.log('script running');

const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Config / constants ===
const BLOCK_SIZE = 70;         
const CHUNK_SIZE_X = 10;       
const CHUNK_SIZE_Z = 10;       
const STONE_LAYERS = 80;       
const groundY = 0;             
const eyeHeight = 110;         // Camera eye level (just below head)
const characterYOffset = 280;  // feet-to-model offset
const maxReach = 6;
const rayStep = 0.5;
let selectedBlock = null;

// === Player state ===
let posX = 0;
let posY = characterYOffset; // start with feet at ground
let posZ = 0;
let yaw = 0, pitch = 0;

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

// === World data ===
const worldData = new Map();
function keyAt(gx, gy, gz) { return `${gx},${gy},${gz}`; }

// === Input handling ===
document.body.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.code === 'Space' && grounded) {
    velY = -jumpStrength;
    grounded = false;
  }
});
document.body.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// pointer lock + mouse look
document.body.addEventListener('click', () => document.body.requestPointerLock());
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
  console.log(`Camera rotation - yaw: ${yaw.toFixed(2)}, pitch: ${pitch.toFixed(2)}`);
  updateTransforms();
}

// === Block helpers ===
function createBlockElement(gx, gy, gz, type, exposedFaces) {
  const el = document.createElement('div');
  el.className = `block ${type}`;
  const px = gx * BLOCK_SIZE;
  const pz = gz * BLOCK_SIZE;
  const py = gy * BLOCK_SIZE;
  el.style.transform = `translate3d(${px}px, ${py}px, ${pz}px)`;

  for (const face of exposedFaces) {
    const faceEl = document.createElement('div');
    faceEl.className = `face ${face}`;
    el.appendChild(faceEl);
  }
  return el;
}

function getExposedFacesFor(gx, gy, gz) {
  const neighbors = [
    {dx:0,dy:-1,dz:0,name:'top'},
    {dx:0,dy:1,dz:0,name:'bottom'},
    {dx:0,dy:0,dz:-1,name:'front'},
    {dx:0,dy:0,dz:1,name:'back'},
    {dx:-1,dy:0,dz:0,name:'left'},
    {dx:1,dy:0,dz:0,name:'right'}
  ];
  const faces = [];
  for (const n of neighbors) {
    if (!worldData.has(keyAt(gx+n.dx,gy+n.dy,gz+n.dz))) faces.push(n.name);
  }
  return faces;
}

// === Crafting recipes ===
const basicRecipes = [
  {
    output: { item: 'maple-crafting-station.block', count: 1},
    pattern: [
      ['maple-planks.block', 'maple-planks.block'],
      ['maple-planks.block', 'maple-planks.block']
      ]
  },
  {
    output: { item: 'pine-crafting-station.block', count: 1},
    pattern: [
      ['pine-planks.block', 'pine-planks.block'],
      ['pine-planks.block', 'pine-planks.block']
      ]
  },
  {
    output: { item: 'oak-crafting-station.block', count: 1},
    pattern: [
      ['oak-planks.block', 'oak-planks.block'],
      ['oak-planks.block', 'oak-planks.block']
      ]
  },
  {
    output: { item: 'cedar-crafting-station.block', count: 1},
    pattern: [
      ['cedar-planks.block', 'cedar-planks.block'],
      ['cedar-planks.block', 'cedar-planks.block']
      ]
  },
  {
    output: { item: 'birch-crafting-station.block', count: 1},
    pattern: [
      ['birch-planks.block', 'birch-planks.block'],
      ['birch-planks.block', 'birch-planks.block']
      ]
  },
  {
    output: { item: 'maple-planks.block', count: 4},
    pattern: [
      [null, null],
      [null, 'maple-log.block']
      ]
  },
  {
    output: { item: 'pine-planks.block', count: 4},
    pattern: [
      [null, null],
      [null, 'pine-log.block']
      ]
  },
  {
    output: { item: 'oak-planks.block', count: 4},
    pattern: [
      [null, null],
      [null, 'oak-log.block']
      ]
  },
  {
    output: { item: 'cedar-planks.block', count: 4},
    pattern: [
      [null, null],
      [null, 'cedar-log.block']
      ]
  },
  {
    output: { item: 'birch-planks.block', count: 4},
    pattern: [
      [null, null],
      [null, 'birch-log.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'maple-planks.block'],
      [null, 'maple-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'pine-planks.block'],
      [null, 'pine-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'oak-planks.block'],
      [null, 'oak-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'cedar-planks.block'],
      [null, 'cedar-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'birch-planks.block'],
      [null, 'birch-planks.block']
      ]
  },
  {
    output: { item: 'stick.block', count: 1},
    pattern: [
      ['stick', 'stick', 'stick'],
      ['stick', 'stick', 'stick'],
      ['stick', 'stick', 'stick']
      ]
  },
  {
    output: { item: 'coal.block', count: 1},
    pattern: [
      ['coal', 'coal', 'coal'],
      ['coal', 'coal', 'coal'],
      ['coal', 'coal', 'coal']
      ]
  },
  {
    output: { item: 'copper.block', count: 1},
    pattern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'copper-bar', 'copper-bar']
      ]
  },
  {
    output: { item: 'tin.block', count: 1},
    pattern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar']
      ]
  },
  {
    output: { item: 'bronze.block', count: 1},
    pattern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar']
      ]
  },
  {
    output: { item: 'iron.block', count: 1},
    pattern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar']
      ]
  },
  {
    output: { item: 'steel.block', count: 1},
    pattern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar']
      ]
  },
  {
    output: { item: 'diamond.block', count: 1},
    pattern: [
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'diamond', 'diamond'],
      ]
  },
  {
    output: { item: 'amber.block', count: 1},
    pattern: [
      ['amber-chunk', 'amber-chunk', 'amber-chunk'],
      ['amber-chunk', 'amber-chunk', 'amber-chunk'],
      ['amber-chunk', 'amber-chunk', 'amber-chunk']
      ]
  },
  {
    output: { item: 'ruby.block', count: 1},
    pattern: [
      ['ruby', 'ruby', 'ruby'],
      ['ruby', 'ruby', 'ruby'],
      ['ruby', 'ruby', 'ruby'],
      ]
  },
  {
    output: { item: 'saw', count: 1},
    pattern: [
     [null, 'iron-bar', null],
     ['iron-bar', null, 'iron-bar'],
     [null, 'iron-bar', null]
     ]
  },
  {
    output: { item: 'maple-cutting-station.block', count: 1},
    pattern: [
      [null, 'saw'],
      [null, 'maple-crafting-station.block']
      ]
  },
  {
    output: { item: 'pine-cutting-station.block', count: 1},
    pattern: [
      [null, 'saw'],
      [null, 'pine-crafting-station.block']
      ]
  },
  {
    output: { item: 'oak-cutting-station.block', count: 1},
    pattern: [
      [null, 'saw'],
      [null, 'oak-crafting-station.block']
      ]
  },
  {
    output: { item: 'cedar-cutting-station.block', count: 1},
    pattern: [
      [null, 'saw'],
      [null, 'cedar-crafting-station.block']
      ]
  },
  {
    output: { item: 'birch-cutting-station.block', count: 1},
    pattern: [
      [null, 'saw'],
      [null, 'birch-crafting-station.block']
      ]
  },
  {
    output: { item: 'maple-chisel', count: 1},
    pattern: [
      [null, 'iron-bar'],
      [null, 'maple-planks.block']
      ]
  },
  {
    output: { item: 'pine-chisel', count: 1},
    pattern: [
      [null, 'iron-bar'],
      [null, 'pine-planks.block']
      ]
  },
  {
    output: { item: 'oak-chisel', count: 1},
    pattern: [
      [null, 'iron-bar'],
      [null, 'oak-planks.block']
      ]
  },
  {
    output: { item: 'cedar-chisel', count: 1},
    pattern: [
      [null, 'iron-bar'],
      [null, 'cedar-planks.block']
      ]
  },
  {
    output: { item: 'birch-chisel', count: 1},
    pattern: [
      [null, 'iron-bar'],
      [null, 'birch-planks.block']
      ]
  },
  {
    output: { item: 'maple-engraving-station.block', count: 1},
    pattern: [
      [null, 'maple-chisel'],
      [null, 'maple-crafting-station.block']
      ]
  },
  {
    output: { item: 'pine-engraving-station.block', count: 1},
    pattern: [
      [null, 'pine-chisel'],
      [null, 'pine-crafting-station.block']
      ]
  },
  {
    output: { item: 'oak-engraving-station.block', count: 1},
    pattern: [
      [null, 'oak-chisel'],
      [null, 'oak-crafting-station.block']
      ]
  },
  {
    output: { item: 'cedar-engraving-station.block', count: 1},
    pattern: [
      [null, 'cedar-chisel'],
      [null, 'cedar-crafting-station.block']
      ]
  },
  {
    output: { item: 'birch-engraving-station.block', count: 1},
    pattern: [
      [null, 'birch-chisel'],
      [null, 'birch-crafting-station.block']
      ]
  },
  {
    output: { item: 'plate', count: 1},
    pattern: [
      [null, 'copper-bar', null],
      ['copper-bar', null, 'copper-bar'],
      [null, 'copper-bar', null]
      ]
  },
  {
    output: { item: 'maple-cooking-station', count: 1},
    pattern: [
      [null, 'plate'],
      [null, 'maple-crafting-station']
      ]
  },
  {
    output: { item: 'pine-cooking-station', count: 1},
    pattern: [
      [null, 'plate'],
      [null, 'pine-crafting-station']
      ]
  },
  {
    output: { item: 'oak-cooking-station', count: 1},
    pattern: [
      [null, 'plate'],
      [null, 'oak-crafting-station']
      ]
  },
  {
    output: { item: 'cedar-cooking-station', count: 1},
    pattern: [
      [null, 'plate'],
      [null, 'cedar-crafting-station']
      ]
  },
  {
    output: { item: 'birch-cooking-station', count: 1},
    pattern: [
      [null, 'plate'],
      [null, 'birch-crafting-station']
      ]
  },
  {
    output: { item: 'bowl', count: 1},
    pattern: [
      [null, null, null,],
      ['copper-bar', null, 'copper-bar'],
      [null, 'copper-bar', null]
      ]
  },
  {
    output: { item: 'smelting-station', count: 1},
    pattern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      ['cobblestone.block', null, 'cobblestone.block'],
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block']
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    pattern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    pattern: [
      ['pine-planks.block', 'pine-planks.block', 'pine-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    pattern: [
      ['oak-planks.block', 'oak-planks.block', 'oak-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    pattern: [
      ['cedar-planks.block', 'cedar-planks.block', 'cedar-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    pattern: [
      ['birch-planks.block', 'birch-planks.block', 'birch-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-pickaxe', count: 1},
    pattern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-pickaxe', count: 1},
    pattern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-pickaxe', count: 1},
    pattern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-pickaxe', count: 1},
    pattern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-pickaxe', count: 1},
    pattern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-pickaxe', count: 1},
    pattern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-pickaxe', count: 1},
    pattern: [
      ['diamond', 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-pickaxe', count: 1},
    pattern: [
      ['copper.block', 'copper.block', 'copper.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-pickaxe', count: 1},
    pattern: [
      ['tin.block', 'tin.block', 'tin.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-pickaxe', count: 1},
    pattern: [
      ['bronze.block', 'bronze.block', 'bronze.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-pickaxe', count: 1},
    pattern: [
      ['iron.block', 'iron.block', 'iron.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-pickaxe', count: 1},
    pattern: [
      ['steel.block', 'steel.block', 'steel.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-pickaxe', count: 1},
    pattern: [
      ['diamond.block', 'diamond.block', 'diamond.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    pattern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    pattern: [
      [null, 'pine-planks.block', null],
      [null, 'pine-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    pattern: [
      [null, 'oak-planks.block', null],
      [null, 'oak-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    pattern: [
      [null, 'cedar-planks.block', null],
      [null, 'cedar-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    pattern: [
      [null, 'birch-planks.block', null],
      [null, 'birch-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-sword', count: 1},
    pattern: [
      [null, 'cobblestone.block', null],
      [null, 'cobblestone.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-sword', count: 1},
    pattern: [
      [null, 'copper-bar', null],
      [null, 'copper-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-sword', count: 1},
    pattern: [
      [null, 'tin-bar', null],
      [null, 'tin-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-sword', count: 1},
    pattern: [
      [null, 'bronze-bar', null],
      [null, 'bronze-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-sword', count: 1},
    pattern: [
      [null, 'iron-bar', null],
      [null, 'iron-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-sword', count: 1},
    pattern: [
      [null, 'steel-bar', null],
      [null, 'steel-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-sword', count: 1},
    pattern: [
      [null, 'diamond', null],
      [null, 'diamond', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-sword', count: 1},
    pattern: [
      [null, 'copper.block', null],
      [null, 'copper.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-sword', count: 1},
    pattern: [
      [null, 'tin.block', null],
      [null, 'tin.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-sword', count: 1},
    pattern: [
      [null, 'bronze.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-sword', count: 1},
    pattern: [
      [null, 'iron.block', null],
      [null, 'iron.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-sword', count: 1},
    pattern: [
      [null, 'steel.block', null],
      [null, 'steel.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-sword', count: 1},
    pattern: [
      [null, 'diamond.block', null],
      [null, 'diamond.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-tip', count: 1},
    pattern: [
      [null, 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-midsection', count: 1},
    pattern: [
      [null, 'dragon-scale', null],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      [null, 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-base', count: 1},
    pattern: [
      [null, 'dragon-scale', null],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade', count: 1},
    pattern: [
      [null, null, 'dragon-sword-blade-tip'],
      [null, 'dragon-sword-blade-midsection', null],
      ['dragon-sword-blade-base', null, null]
      ]
  },
  {
    output: { item: 'dragon-sword-handle', count: 1},
    pattern: [
      ['stick', null, 'amber-chunk'],
      [null, 'ruby', null],
      ['stick', null, 'stick']
      ]
  },
  {
    output: { item: 'dragon-sword', count: 1},
    pattern: [
      [null, 'dragon-sword-blade'],
      ['dragon-sword-handle', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-tip', count: 1},
    pattern: [
      [null, 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-midsection', count: 1},
    pattern: [
      [null, 'dragon-scale.block', null],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      [null, 'dragon-scale.block', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-base', count: 1},
    pattern: [
      [null, 'dragon-scale.block', null],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade', count: 1},
    pattern: [
      [null, null, 'absolute-unit-sword-blade-tip'],
      [null, 'absolute-unit-sword-blade-midsection', null],
      ['absolute-unit-sword-blade-base', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-handle', count: 1},
    pattern: [
      ['stick.block', null, 'amber.block'],
      [null, 'ruby.block', null],
      ['stick.block', null, 'stick.block']
      ]
  },
  {
    output: { item: 'absolute-unit-sword', count: 1},
    pattern: [
      [null, 'absolute-unit-sword-blade'],
      ['absolute-unit-sword-handle', null]
      ]
  },
  {
    output: { item: 'wood-axe', count: 1},
    pattern: [
      [null, 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', 'maple-planks.block'],
      [null, 'stick', 'stick']
      ]
  },
  {
    output: { item: 'stone-axe', count: 1},
    pattern: [
      [null, 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', 'cobblestone.block'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-axe', count: 1},
    pattern: [
      [null, 'copper-bar', 'copper-bar'],
      [null, 'stick', 'copper-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-axe', count: 1},
    pattern: [
      [null, 'tin-bar', 'tin-bar'],
      [null, 'stick', 'tin-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-axe', count: 1},
    pattern: [
      [null, 'bronze-bar', 'bronze-bar'],
      [null, 'stick', 'bronze-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-axe', count: 1},
    pattern: [
      [null, 'iron-bar', 'iron-bar'],
      [null, 'stick', 'iron-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-axe', count: 1},
    pattern: [
      [null, 'steel-bar', 'steel-bar'],
      [null, 'stick', 'steel-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-axe', count: 1},
    pattern: [
      [null, 'diamond', 'diamond'],
      [null, 'stick', 'diamond'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-axe', count: 1},
    pattern: [
      [null, 'copper.block', 'copper.block'],
      [null, 'stick.block', 'copper.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-axe', count: 1},
    pattern: [
      [null, 'tin.block', 'tin.block'],
      [null, 'stick.block', 'tin.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-axe', count: 1},
    pattern: [
    [null, 'bronze.block', 'bronze.block'],
    [null, 'stick.block', 'bronze.block'],
    [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-axe', count: 1},
    pattern: [
      [null, 'iron.block', 'iron.block'],
      [null, 'stick.block', 'iron.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-axe', count: 1},
    pattern: [
      [null, 'steel.block', 'steel.block'],
      [null, 'stick.block', 'steel.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-axe', count: 1},
    pattern: [
      [null, 'diamond.block', 'diamond.block'],
      [null, 'stick.block', 'diamond.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    pattern: [
      [null, 'maple-planks.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    pattern: [
      [null, 'pine-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    pattern: [
      [null, 'oak-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    pattern: [
      [null, 'cedar-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    pattern: [
      [null, 'birch-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-shovel', count: 1},
    pattern: [
      [null, 'cobblestone.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-shovel', count: 1},
    pattern: [
      [null, 'copper-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-shovel', count: 1},
    pattern: [
      [null, 'tin-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-shovel', count: 1},
    pattern: [
      [null, 'bronze-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-shovel', count: 1},
    pattern: [
      [null, 'iron-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-shovel', count: 1},
    pattern: [
      [null, 'steel-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-shovel', count: 1},
    pattern: [
      [null, 'diamond', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-shovel', count: 1},
    pattern: [
      [null, 'copper.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-shovel', count: 1},
    pattern: [
      [null, 'tin.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-shovel', count: 1},
    pattern: [
      [null, 'bronze.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-shovel', count: 1},
    pattern: [
      [null, 'iron.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-shovel', count: 1},
    pattern: [
      [null, 'steel.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-shovel', count: 1},
    pattern: [
      [null, 'diamond.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    pattern: [
      [null, 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    pattern: [
      [null, 'pine-planks.block', 'pine-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    pattern: [
      [null, 'oak-planks.block', 'oak-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    pattern: [
      [null, 'cedar-planks.block', 'cedar-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    pattern: [
      [null, 'birch-planks.block', 'birch-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-hoe', count: 1},
    pattern: [
      [null, 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-hoe', count: 1},
    pattern: [
      [null, 'copper-bar', 'copper-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-hoe', count: 1},
    pattern: [
      [null, 'tin-bar', 'tin-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-hoe', count: 1},
    pattern: [
      [null, 'bronze-bar', 'bronze-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-hoe', count: 1},
    pattern: [
      [null, 'iron-bar', 'iron-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-hoe', count: 1},
    pattern: [
      [null, 'steel-bar', 'steel-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-hoe', count: 1},
    pattern: [
      [null, 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-hoe', count: 1},
    pattern: [
      [null, 'copper.block', 'copper.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-hoe', count: 1},
    pattern: [
      [null, 'tin.block', 'tin.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-hoe', count: 1},
    pattern: [
      [null, 'bronze.block', 'bronze.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-hoe', count: 1},
    pattern: [
      [null, 'iron.block', 'iron.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-hoe', count: 1},
    pattern: [
      [null, 'steel.block', 'steel.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-hoe', count: 1},
    pattern: [
      [null, 'diamond.block', 'diamond.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'maple-locker.block', count: 1},
    pattern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      ['maple-planks.block', null, 'maple-planks.block'],
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block']
      ]
  },
  {
    output: { item: 'stone-locker.block', count: 1},
    pattern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      ['cobblestone.block', 'maple-locker.block', 'cobblestone.block'],
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block']
      ]
  },
  {
    output: { item: 'copper-locker.block', count: 1},
    pattern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'stone-locker.block', 'copper.block'],
      ['copper-bar', 'copper-bar', 'copper-bar']
      ]
  },
  {
    output: { item: 'tin-locker.block', count: 1},
    pattern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'copper-locker.block', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar']
      ]
  },
  {
    output: { item: 'bronze-locker.block', count: 1},
    pattern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'tin-locker.block', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar']
      ]
  },
  {
    output: { item: 'iron-locker.block', count: 1},
    pattern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'bronze-locker.block', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar']
      ]
  },
  {
    output: { item: 'steel-locker.block', count: 1},
    pattern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'iron-locker.block', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar']
      ]
  },
  {
    output: { item: 'diamond-locker.block', count: 1},
    pattern: [
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'steel-locker.block', 'diamond'],
      ['diamond', 'diamond', 'diamond']
      ]
  }
    ];
// --- Fuel definitions ---
const fuelItems = {
    'maple-log.block': 6,
    'maple-planks.block': 4,
    'maple-planks.slab': 2,
    'maple-planks.small-stairs': 1,
    'maple-planks.large-stairs': 3,
    'pine-log.block': 6,
    'pine-planks.slab': 4,
    'pine-planks.block': 2,
    'pine-planks.small-stairs': 1,
    'pine-planks.large-stairs': 3,
    'oak-log.block': 6,
    'oak-planks.block': 4,
    'oak-planks.slab': 2,
    'oak-planks.small-stairs': 1,
    'oak-planks.large-stairs': 3,
    'cedar-log.block': 6,
    'cedar-planks.block': 4,
    'cedar-planks.slab': 2,
    'cedar-planks.small-stairs': 1,
    'cedar-planks.large-stairs': 3,
    'birch-log.block': 6,
    'birch-planks.block': 4,
    'birch-planks.slab': 2,
    'birch-planks.small-stairs': 1,
    'birch-planks.large-stairs': 3,
    'stick': 1,
    'coal': 25,
    'charcoal': 10,
};

// --- Smelting recipes ---
const smeltingRecipes = [
    // Single-item smelting
    { input: ['copper-ore.block'], output: ['copper-bar'] },
    { input: ['tin-ore.block'], output: ['tin-bar'] },
    { input: ['iron-ore.block'], output: ['iron-bar'] },
    { input: ['maple-log.block'], output: ['charcoal'] },
    { input: ['pine-log.block'], output: ['charcoal'] },
    { input: ['oak-log.block'], output: ['charcoal'] },
    { input: ['cedar-log.block'], output: ['charcoal'] },
    { input: ['birch-log.block'], output: ['charcoal'] },

    // Two-item recipes
    { input: ['copper-bar', 'tin-bar'], output: ['bronze-bar', 'bronze-bar'] },
    { input: ['iron-bar', 'charcoal'], output: ['steel-bar'] },
];

// --- Smelting station state ---
class SmeltingStation {
    constructor() {
        this.input = [
            [null, null],
            [null, null]
        ]; // 2x2 input grid
        this.output = [
            [null, null],
            [null, null]
        ]; // 2x2 output grid
        this.fuelSlot = null; // single fuel slot
        this.fuelAmount = 0; // remaining items of fuel
        this.progressGrid = [
            [0, 0],
            [0, 0]
        ]; // smelting progress for each input
        this.recipeGrid = [
            [null, null],
            [null, null]
        ]; // matched recipe for each slot
    }

    // Check if a single item has a smelting recipe
    getRecipeForItem(item) {
        for (const recipe of smeltingRecipes) {
            if (recipe.input.length === 1 && recipe.input[0] === item) return recipe;
            if (recipe.input.length === 2 && recipe.input.includes(item)) return recipe;
        }
        return null;
    }

    // Check if output grid has space for a given item
    canOutput(item) {
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                if (!this.output[y][x] || this.output[y][x].count < 64) return true;
            }
        }
        return false;
    }

    // Add smelted item to output grid
    addToOutput(item) {
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                if (!this.output[y][x]) {
                    this.output[y][x] = { item: item, count: 1 };
                    return true;
                } else if (this.output[y][x].item === item && this.output[y][x].count < 64) {
                    this.output[y][x].count++;
                    return true;
                }
            }
        }
        return false; // no space
    }

    // Main smelting update function, called every animation frame
    update() {
        for (let y = 0; y < 2; y++) {
            for (let x = 0; x < 2; x++) {
                const slotItem = this.input[y][x];
                if (!slotItem) {
                    this.progressGrid[y][x] = 0;
                    this.recipeGrid[y][x] = null;
                    continue;
                }

                // Get the recipe for this item
                let recipe = this.getRecipeForItem(slotItem.item);
                if (!recipe) continue;

                // Check if output can accept the item
                const outputItem = recipe.output[0]; // single output for single-item recipes
                if (!this.canOutput(outputItem)) continue;

                // Consume fuel if needed
                if (this.fuelAmount <= 0) {
                    if (!this.fuelSlot || !fuelItems[this.fuelSlot.item]) continue;
                    this.fuelAmount += fuelItems[this.fuelSlot.item];
                    this.fuelSlot.count--;
                    if (this.fuelSlot.count <= 0) this.fuelSlot = null;
                }

                // Advance progress
                this.progressGrid[y][x]++;
                if (this.progressGrid[y][x] >= 600) { // 600 frames = 10 seconds
                    if (this.addToOutput(outputItem)) {
                        slotItem.count--;
                        if (slotItem.count <= 0) this.input[y][x] = null;
                        this.progressGrid[y][x] = 0;
                        this.fuelAmount--;
                    }
                }
            }
        }
    }
}
      
const cuttingRecipes = {
  // Blocks with slabs and stairs
  'maple-planks.block': [
    { item: 'maple-planks.slab', count: 2 },
    { items: [
        { item: 'maple-planks.large-stairs', count: 1 },
        { item: 'maple-planks.small-stairs', count: 1 }
      ] 
    },
    { item: 'maple-planks.small-stairs', count: 4 }
  ],
  'pine-planks.block': [
    { item: 'pine-planks.slab', count: 2 },
    { items: [
        { item: 'pine-planks.large-stairs', count: 1 },
        { item: 'pine-planks.small-stairs', count: 1 }
      ] 
    },
    { item: 'pine-planks.small-stairs', count: 4 }
  ],
  'oak-planks.block': [
    { item: 'oak-planks.slab', count: 2 },
    { items: [
        { item: 'oak-planks.large-stairs', count: 1 },
        { item: 'oak-planks.small-stairs', count: 1 }
      ] 
    },
    { item: 'oak-planks.small-stairs', count: 4 }
  ],
  'cedar-planks.block': [
    { item: 'cedar-planks.slab', count: 2 },
    { items: [
        { item: 'cedar-planks.large-stairs', count: 1 },
        { item: 'cedar-planks.small-stairs', count: 1 }
      ] 
    },
    { item: 'cedar-planks.small-stairs', count: 4 }
  ],
  'birch-planks.block': [
    { item: 'birch-planks.slab', count: 2 },
    { items: [
        { item: 'birch-planks.large-stairs', count: 1 },
        { item: 'birch-planks.small-stairs', count: 1 }
      ] 
    },
    { item: 'birch-planks.small-stairs', count: 4 }
  ],
  'maple-log.block': [
    { item: 'maple-log.slab', count: 2 },
    { items: [
        { item: 'maple-log.large-stairs', count: 1 },
        { item: 'maple-log.small-stairs', count: 1 }
      ] 
    },
    { item: 'maple-log.small-stairs', count: 4 }
  ],
  'pine-log.block': [
    { item: 'pine-log.slab', count: 2 },
    { items: [
        { item: 'pine-log.large-stairs', count: 1 },
        { item: 'pine-log.small-stairs', count: 1 }
      ] 
    },
    { item: 'pine-log.small-stairs', count: 4 }
  ],
  'oak-log.block': [
    { item: 'oak-log.slab', count: 2 },
    { items: [
        { item: 'oak-log.large-stairs', count: 1 },
        { item: 'oak-log.small-stairs', count: 1 }
      ] 
    },
    { item: 'oak-log.small-stairs', count: 4 }
  ],
  'cedar-log.block': [
    { item: 'cedar-log.slab', count: 2 },
    { items: [
        { item: 'cedar-log.large-stairs', count: 1 },
        { item: 'cedar-log.small-stairs', count: 1 }
      ] 
    },
    { item: 'cedar-log.small-stairs', count: 4 }
  ],
  'birch-log.block': [
    { item: 'birch-log.slab', count: 2 },
    { items: [
        { item: 'birch-log.large-stairs', count: 1 },
        { item: 'birch-log.small-stairs', count: 1 }
      ] 
    },
    { item: 'birch-log.small-stairs', count: 4 }
  ],
  'stone.block': [
    { item: 'stone.slab', count: 2 },
    { items: [
        { item: 'stone.large-stairs', count: 1 },
        { item: 'stone.small-stairs', count: 1 }
      ] 
    },
    { item: 'stone.small-stairs', count: 4 }
  ],
  'cobblestone.block': [
    { item: 'cobblestone.slab', count: 2 },
    { items: [
        { item: 'cobblestone.large-stairs', count: 1 },
        { item: 'cobblestone.small-stairs', count: 1 }
      ] 
    },
    { item: 'cobblestone.small-stairs', count: 4 }
  ],
  'stone-bricks.block': [
    { item: 'stone-bricks.slab', count: 2 },
    { items: [
        { item: 'stone-bricks.large-stairs', count: 1 },
        { item: 'stone-bricks.small-stairs', count: 1 }
      ] 
    },
    { item: 'stone-bricks.small-stairs', count: 4 }
  ],
  'chisled-stone.block': [
    { item: 'chisled-stone.slab', count: 2 },
    { items: [
        { item: 'chisled-stone.large-stairs', count: 1 },
        { item: 'chisled-stone.small-stairs', count: 1 }
      ] 
    },
    { item: 'chisled-stone.small-stairs', count: 4 }
  ],
  'cobblestone-bricks.block': [
    { item: 'cobblestone-bricks.slab', count: 2 },
    { items: [
        { item: 'cobblestone-bricks.large-stairs', count: 1 },
        { item: 'cobblestone-bricks.small-stairs', count: 1 }
      ] 
    },
    { item: 'cobblestone-bricks.small-stairs', count: 4 }
  ],
  'copper.block': [
    { item: 'copper.slab', count: 2 },
    { items: [
        { item: 'copper.large-stairs', count: 1 },
        { item: 'copper.small-stairs', count: 1 }
      ] 
    },
    { item: 'copper.small-stairs', count: 4 }
  ],
  'tin.block': [
    { item: 'tin.slab', count: 2 },
    { items: [
        { item: 'tin.large-stairs', count: 1 },
        { item: 'tin.small-stairs', count: 1 }
      ] 
    },
    { item: 'tin.small-stairs', count: 4 }
  ],
  'bronze.block': [
    { item: 'bronze.slab', count: 2 },
    { items: [
        { item: 'bronze.large-stairs', count: 1 },
        { item: 'bronze.small-stairs', count: 1 }
      ] 
    },
    { item: 'bronze.small-stairs', count: 4 }
  ],
  'steel.block': [
    { item: 'steel.slab', count: 2 },
    { items: [
        { item: 'steel.large-stairs', count: 1 },
        { item: 'steel.small-stairs', count: 1 }
      ] 
    },
    { item: 'steel.small-stairs', count: 4 }
  ],

  // Blocks with slabs only
  'sand.block': [ { item: 'sand.slab', count: 2 } ],
  'gravel.block': [ { item: 'gravel.slab', count: 2 } ],
  'maple-leaves.block': [ { item: 'maple-leaves.slab', count: 2 } ],
  'pine-leaves.block': [ { item: 'pine-leaves.slab', count: 2 } ],
  'oak-leaves.block': [ { item: 'oak-leaves.slab', count: 2 } ],
  'cedar-leaves.block': [ { item: 'cedar-leaves.slab', count: 2 } ],
  'birch-leaves.block': [ { item: 'birch-leaves.slab', count: 2 } ],
  'coal.block': [ { item: 'coal.slab', count: 2 } ],
  'iron.block': [ { item: 'iron.slab', count: 2 } ],
  'diamond.block': [ { item: 'diamond.slab', count: 2 } ],
  'ruby.block': [ { item: 'ruby.slab', count: 2 } ],
  'amber.block': [ { item: 'amber.slab', count: 2 } ]
};

const engravingRecipes = {
  'stone.block': [
    { item: 'stone-bricks.block', count: 1},
    { item: 'chisled-stone.block', count: 1}
    ],
  'cobblestone.block': [
    { item: 'cobblestone-bricks.block', count: 1},
    { item: 'chisled-cobblestone.block', count: 1}
    ],
};

const cookingRecipes = [
  {
    output: { item: 'dough', count: 1 },
    pattern: [
      [null, null],
      ['wheat', 'water-bucket']
    ]
  },
  {
    output: { item: 'loaf', count: 1 },
    pattern: [
      [null, null],
      [null, 'dough']
    ]
  },
  {
    output: { item: 'noodles', count: 1 },
    pattern: [
      [null, null],
      ['dough', 'dough']
    ]
  },
  {
    output: { item: 'spagheti', count: 1 },
    pattern: [
      ['noodles', 'tomato'],
      ['plate', null]
    ]
  },
  {
    output: { item: 'soup', count: 1 },
    pattern: [
      ['tomato', 'potato'],
      ['bowl', 'carrot']
    ]
  },
  {
    output: { item: 'pumpkin-pie', count: 1 },
    pattern: [
      ['pumpkin', 'dough'],
      [null, null]
    ]
  },
  {
    output: { item: 'bread', count: 8 },
    pattern: [
      [null, null],
      [null, 'loaf']
    ]
  },
  {
    output: { item: 'sandwich', count: 1 },
    pattern: [
      ['bread', 'tomato'],
      ['tomato', 'bread']
    ]
  },
  {
    output: { item: 'pancakes', count: 1 },
    pattern: [
      ['dough', null],
      ['plate', null]
    ]
  },
  {
    output: { item: 'pancakes-with-syrup', count: 1 },
    pattern: [
      ['bucket-of-syrup', null],
      ['pancakes', null]
    ]
  }
];

class CookingStation {
  constructor() {
    this.inputGrid = [
      [null, null],
      [null, null]
    ];
    this.outputSlot = null;
    this.recipes = cookingRecipes; // Use the recipes you already defined
  }

  // Set an item in the input grid
  setInput(x, y, item) {
    this.inputGrid[y][x] = item;
    this.updateOutput();
  }

  // Check all recipes and update the output slot
  updateOutput() {
    this.outputSlot = null; // Reset first
    for (let recipe of this.recipes) {
      if (this.matchesPattern(recipe.pattern)) {
        this.outputSlot = { ...recipe.output }; // Copy the output
        break;
      }
    }
  }

  // Check if the input grid matches a recipe pattern exactly
  matchesPattern(pattern) {
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        if ((this.inputGrid[y][x] || null) !== (pattern[y][x] || null)) {
          return false;
        }
      }
    }
    return true;
  }

  // Called when player clicks the output slot
  craftOutput(playerInventory) {
    if (!this.outputSlot) return false;

    // Check inventory space first
    if (!playerInventory.canAdd(this.outputSlot.item, this.outputSlot.count)) {
      return false; // Can't craft, no room
    }

    // Remove ingredients
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        this.inputGrid[y][x] = null;
      }
    }

    // Add result to inventory
    playerInventory.add(this.outputSlot.item, this.outputSlot.count);
    this.updateOutput();
    return true;
  }
}


const allRecipes = {
  'maple-crafting-station.block': basicRecipes,
  'pine-crafting-station.block': basicRecipes,
  'oak-crafting-station.block': basicRecipes,
  'cedar-crafting-station.block': basicRecipes,
  'birch-crafting-station.block': basicRecipes,
  'maple-cutting-station.block': cuttingRecipes,
  'pine-cutting-station.block': cuttingRecipes,
  'oak-cutting-station.block': cuttingRecipes,
  'cedar-cutting-station.block': cuttingRecipes,
  'birch-cutting-station.block': cuttingRecipes,
  'maple-engraving-station.block': engravingRecipes,
  'pine-engraving-station.block': engravingRecipes,
  'oak-engraving-station.block': engravingRecipes,
  'cedar-engraving-station.block': engravingRecipes,
  'birch-engraving-station.block': engravingRecipes,
  'maple-cooking-station.block': cookingRecipes,
  'pine-cooking-station.block': cookingRecipes,
  'oak-cooking-station.block': cookingRecipes,
  'cedar-cooking-station.block': cookingRecipes,
  'birch-cooking-station.block': cookingRecipes,
  'smelting-station.block': smeltingRecipes,
};
    
  
      
// === Ore vein generator ===
function generateVein(startGX, startGY, startGZ, size, type) {
  const placed = [];
  const stack = [{x:startGX,y:startGY,z:startGZ}];
  const visited = new Set();
  while (stack.length > 0 && placed.length < size) {
    const idx = Math.floor(Math.random() * stack.length);
    const cur = stack.splice(idx,1)[0];
    const k = keyAt(cur.x, cur.y, cur.z);
    if (visited.has(k)) continue;
    visited.add(k);

    const existing = worldData.get(k);
    if (existing === 'stone') {
      worldData.set(k,type);
      placed.push({x:cur.x,y:cur.y,z:cur.z});
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
      if (n.x<0||n.x>=CHUNK_SIZE_X||n.z<0||n.z>=CHUNK_SIZE_Z||n.y<0||n.y>=STONE_LAYERS) continue;
      if (!visited.has(keyAt(n.x,n.y,n.z)) && Math.random()<0.9) stack.push(n);
    }
  }
  return placed;
}

// === Multi-layer world generation ===
function generateMultiLayerWorld() {
  world.innerHTML='';
  worldData.clear();

  for (let gx=0;gx<CHUNK_SIZE_X;gx++){
    for (let gz=0;gz<CHUNK_SIZE_Z;gz++){
      const dirtLayers=Math.floor(Math.random()*2)+2;
      worldData.set(keyAt(gx,0,gz),'grass');
      for (let y=1;y<=dirtLayers;y++) worldData.set(keyAt(gx,y,gz),'dirt');
      for (let y=dirtLayers+1;y<STONE_LAYERS;y++) worldData.set(keyAt(gx,y,gz),'stone');
    }
  }

  const ores = [
    { name: 'coal-ore', minD:1,maxD:15,veins:2,size:15 },
    { name: 'copper-ore', minD:10,maxD:20,veins:2,size:10 },
    { name: 'tin-ore', minD:10,maxD:20,veins:2,size:10 },
    { name: 'iron-ore', minD:20,maxD:35,veins:2,size:7 },
    { name: 'diamond-ore', minD:35,maxD:50,veins:1,size:4 },
    { name: 'amber-ore', minD:50,maxD:80,veins:1,size:1 },
    { name: 'ruby-ore', minD:50,maxD:80,veins:1,size:1 }
  ];

  for (const ore of ores) {
    for (let v=0;v<ore.veins;v++){
      const gx=Math.floor(Math.random()*CHUNK_SIZE_X);
      const gz=Math.floor(Math.random()*CHUNK_SIZE_Z);
      const minLayer=Math.max(1,ore.minD);
      const maxLayer=Math.min(STONE_LAYERS-1,ore.maxD);
      if (minLayer>maxLayer) continue;
      const gy=Math.floor(minLayer + Math.random()*(maxLayer-minLayer+1));
      generateVein(gx,gy,gz,ore.size,ore.name);
    }
  }

  let created=0;
  for (const [k,type] of worldData.entries()){
    const [gx,gy,gz]=k.split(',').map(Number);
    const exposed=getExposedFacesFor(gx,gy,gz);
    if (exposed.length===0) continue;
    const el=createBlockElement(gx,gy,gz,type,exposed);
    world.appendChild(el);
    created++;
  }
  console.log('generateMultiLayerWorld: worldData size',worldData.size,'created DOM blocks',created);
}

// === Character creation ===
function createCharacter(){
  playerModel.innerHTML='';
  const parts=[
    {className:'torso'},{className:'head'},
    {className:'arm left'},{className:'arm right'},
    {className:'leg left'},{className:'leg right'}
  ];
  parts.forEach(({className})=>{
    const part=document.createElement('div');
    part.className=`part ${className}`;
    ['front','back','left','right','top','bottom'].forEach(face=>{
      const faceDiv=document.createElement('div');
      faceDiv.className=`face ${face}`;
      part.appendChild(faceDiv);
    });
    playerModel.appendChild(part);
  });
}

// === Collision / surface ===
function getTopSurfaceYUnderPlayer(){
  const gx=Math.floor(posX/BLOCK_SIZE);
  const gz=Math.floor(posZ/BLOCK_SIZE);
  for (let gy=0;gy<STONE_LAYERS;gy++){
    if(worldData.has(keyAt(gx,gy,gz))) return gy*BLOCK_SIZE;
  }
  return undefined;
}

// === Player movement / collision ===
function updatePlayerPosition() {
  // Movement input
  let forward = 0, right = 0;
  if (keys['w']) forward += 1;
  if (keys['s']) forward -= 1;
  if (keys['d']) right += 1;
  if (keys['a']) right -= 1;

  // Convert yaw to radians
  const rad = yaw * Math.PI / 180;

  // Move relative to camera direction
  posX += (forward * Math.sin(rad) + right * Math.cos(rad)) * speed;
  posZ += (forward * Math.cos(rad) - right * Math.sin(rad)) * speed;

  // Gravity
  velY += gravity;
  posY += velY;

  // Ground collision
  const surfaceY = getTopSurfaceYUnderPlayer();
  const feetY = posY - characterYOffset;
  if (surfaceY !== undefined && feetY < surfaceY) {
    posY = surfaceY + characterYOffset;
    velY = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  // Jump
  if (keys[' '] && grounded) {
    velY = jumpStrength;
    grounded = false;
  }
}

document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'e') {
    const panel = document.getElementById('inventory-panel');
    panel.classList.toggle('visible');
  }
});

  // --- Rotate player model horizontally ---
let smoothPosX = posX;
let smoothPosY = posY;
let smoothPosZ = posZ;
let smoothYaw = yaw;
let smoothPitch = pitch;

// Linear interpolation helper
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// === Updated updateTransforms with smoothing ===
function updateTransforms() {
  const smoothFactor = 0.15; // smaller = smoother

  // Smoothly interpolate position
  smoothPosX = lerp(smoothPosX, posX, smoothFactor);
  smoothPosY = lerp(smoothPosY, posY, smoothFactor);
  smoothPosZ = lerp(smoothPosZ, posZ, smoothFactor);

  // Smoothly interpolate rotation
  smoothYaw = lerp(smoothYaw, yaw, smoothFactor);
  smoothPitch = lerp(smoothPitch, pitch, smoothFactor);

  // Move & rotate the world relative to camera
  world.style.transform = `
    translate3d(${-smoothPosX}px, ${-smoothPosY + 700}px, ${-smoothPosZ}px)
    rotateX(${-smoothPitch}deg)
    rotateY(${-smoothYaw}deg)
  `;
}

// --- Unified station update function ---
function updateStation(grid, recipes, setResult, clearResult, options = {}) {
  const { strictPositions = false, multiOutput = false } = options;

  function matchRecipe(grid, pattern) {
    const rows = grid.length;
    const cols = grid[0].length;
    const pr = pattern.length;
    const pc = pattern[0].length;

    if (strictPositions) {
      // Exact-position matching for cooking / special stations
      if (pr !== rows || pc !== cols) return false;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (pattern[y][x] !== null && grid[y][x] !== pattern[y][x]) return false;
        }
      }
      return true;
    }

    // Flexible matching for crafting/cutting/engraving
    function matchesAtOffset(offsetY, offsetX, p) {
      for (let y = 0; y < pr; y++) {
        for (let x = 0; x < pc; x++) {
          const gridItem = grid[y + offsetY][x + offsetX];
          if (p[y][x] !== null && gridItem !== p[y][x]) return false;
        }
      }
      return true;
    }

    function generateTransforms(p) {
      const transforms = [p];

      // Rotations: 90, 180, 270
      for (let i = 0; i < 3; i++) {
        const prev = transforms[transforms.length - 1];
        const rotated = prev[0].map((_, col) => prev.map(row => row[col]).reverse());
        transforms.push(rotated);
      }

      // Horizontal flips
      const flips = transforms.map(t => t.map(row => row.slice().reverse()));
      transforms.push(...flips);

      return transforms;
    }

    const variants = generateTransforms(pattern);

    for (const v of variants) {
      const vRows = v.length;
      const vCols = v[0].length;
      if (vRows > rows || vCols > cols) continue;

      for (let y = 0; y <= rows - vRows; y++) {
        for (let x = 0; x <= cols - vCols; x++) {
          if (matchesAtOffset(y, x, v)) return true;
        }
      }
    }

    return false;
  }

  for (const recipe of recipes) {
    if (matchRecipe(grid, recipe.pattern)) {
      setResult(recipe.output, multiOutput ? recipe : null);
      return;
    }
  }

  clearResult();
}

// --- Station-specific wrappers ---

function update2x2Crafting() {
  const grid = [
    [getCraftingSlot(0), getCraftingSlot(1)],
    [getCraftingSlot(2), getCraftingSlot(3)]
  ];
  updateStation(grid, basicRecipes, setCraftingResult, clearCraftingResult);
}

function update3x3CraftingTable() {
  const grid = [
    [getTableSlot(0), getTableSlot(1), getTableSlot(2)],
    [getTableSlot(3), getTableSlot(4), getTableSlot(5)],
    [getTableSlot(6), getTableSlot(7), getTableSlot(8)]
  ];
  updateStation(grid, advancedRecipes, setTableResult, clearTableResult);
}

function updateCookingStation() {
  const grid = [
    [getCookingSlot(0), getCookingSlot(1)],
    [getCookingSlot(2), getCookingSlot(3)]
  ];
  updateStation(grid, cookingRecipes, setCookingResult, clearCookingResult, { strictPositions: true });
}

function updateSmeltingStation() {
  const grid = [
    [getSmeltInput(0), getSmeltInput(1)],
    [getSmeltInput(2), getSmeltInput(3)]
  ];
  updateStation(grid, smeltingRecipes, setSmeltingResult, clearSmeltingResult, { multiOutput: true });
}

function updateCuttingStation() {
  const grid = [
    [getCuttingSlot(0), getCuttingSlot(1)],
    [getCuttingSlot(2), getCuttingSlot(3)]
  ];
  updateStation(grid, cuttingRecipes, setCuttingResult, clearCuttingResult);
}

function updateEngravingStation() {
  const grid = [
    [getEngravingSlot(0), getEngravingSlot(1)],
    [getEngravingSlot(2), getEngravingSlot(3)]
  ];
  updateStation(grid, engravingRecipes, setEngravingResult, clearEngravingResult);
}

// --- Call in your game loop or on any station update ---
function refreshAllStations() {
  update2x2Crafting();
  update3x3CraftingTable();
  updateCookingStation();
  updateSmeltingStation();
  updateCuttingStation();
  updateEngravingStation();
}

function raycastFromCamera(maxDistance = 6, step = 0.5) {
  const yawRad = yaw * Math.PI / 180;
  const pitchRad = pitch * Math.PI / 180;

  const dirX = Math.sin(yawRad) * Math.cos(pitchRad);
  const dirY = -Math.sin(pitchRad); // Inverted Y-axis
  const dirZ = Math.cos(yawRad) * Math.cos(pitchRad);

  let x = posX;
  let y = posY;
  let z = posZ;

  for (let d = 0; d < maxDistance; d += step) {
    x += dirX * step;
    y += dirY * step;
    z += dirZ * step;

    const gx = Math.floor(x / BLOCK_SIZE);
    const gy = Math.floor(y / BLOCK_SIZE);
    const gz = Math.floor(z / BLOCK_SIZE);

    const block = getBlock(gx, gy, gz);
    if (block && block !== 'air') {
      return { hit: true, gx, gy, gz };
    }
  }

  return { hit: false };
}

function getAdjacentPlacementPos(block) {
  const offsetX = Math.sign((block.x + 0.5) * blockSize - posX);
  const offsetY = Math.sign((block.y + 0.5) * blockSize - posY);
  const offsetZ = Math.sign((block.z + 0.5) * blockSize - posZ);

  const px = block.x + offsetX;
  const py = block.y + offsetY;
  const pz = block.z + offsetZ;

  const key = `${px},${py},${pz}`;
  if (!blocks[key]) {
    return { x: px, y: py, z: pz };
  }
  return null;
}

function breakBlock(x, y, z) {
  const key = `${x},${y},${z}`;
  const block = blocks[key];
  if (block) {
    block.remove();
    delete blocks[key];
  }
}

function placeBlock(x, y, z, blockType) {
  const key = `${x},${y},${z}`;
  if (!blocks[key]) {
    createBlock(x, y, z, blockType);
  }
}

let highlightedEl = null;

function updateBlockHighlight() {
  if (highlightedEl) highlightedEl.classList.remove('highlighted');

  const result = raycastFromCamera();
  if (!result.hit) return;

  const key = `${result.gx},${result.gy},${result.gz}`;
  const el = world.querySelector(`.block[data-key="${key}"]`);
  if (el) {
    el.classList.add('highlighted');
    highlightedEl = el;
  }
}

document.addEventListener('mousedown', (e) => {
  const result = raycastFromCamera();
  if (!result.hit) return;

  const { gx, gy, gz } = result;

  if (e.button === 0) {
    // Left-click: Break block
    setBlock(gx, gy, gz, null); // or worldData.delete(key)
    generateMultiLayerWorld(); // refresh
  }

  if (e.button === 2) {
    // Right-click: Place block
    const selected = getSelectedHotbarBlock();
    if (!selected) return;

    const px = gx;
    const py = gy + 1;
    const pz = gz;
    if (!getBlock(px, py, pz)) {
      setBlock(px, py, pz, selected);
      generateMultiLayerWorld();
    }
  }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

// === Game loop ===
function animate(){
  updateBlockhighlight();
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateMultiLayerWorld();
myStation.update();
createCharacter();
console.log('World generated. Starting posY:', posY,'groundY:',groundY);
animate();
