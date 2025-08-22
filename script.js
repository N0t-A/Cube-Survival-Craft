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
    output: { item: 'maple-crafting-station', count: 1},
    pattern: [
      ['maple-planks', 'maple-planks'],
      ['maple-planks', 'maple-planks']
      ]
  },
  {
    output: { item: 'pine-crafting-station', count: 1},
    patern: [
      ['pine-planks', 'pine-planks'],
      ['pine-planks', 'pine-planks']
      ]
  },
  {
    output: { item: 'oak-crafting-station', count: 1},
    patern: [
      ['oak-planks', 'oak-planks'],
      ['oak-planks', 'oak-planks']
      ]
  },
  {
    output: { item: 'cedar-crafting-station', count: 1},
    patern: [
      ['cedar-planks', 'cedar-planks'],
      ['cedar-planks', 'cedar-planks']
      ]
  },
  {
    output: { item: 'birch-crafting-station', count: 1},
    patern: [
      ['birch-planks', 'birch-planks'],
      ['birch-planks', 'birch-planks']
      ]
  },
  {
    output: { item: 'maple-planks', count: 4},
    patern: [
      [null, null],
      [null, 'maple-log']
      ]
  },
  {
    output: { item: 'pine-planks', count: 4},
    patern: [
      [null, null],
      [null, 'pine-log']
      ]
  },
  {
    output: { item: 'oak-planks', count: 4},
    patern: [
      [null, null],
      [null, 'oak-log']
      ]
  },
  {
    output: { item: 'cedar-planks', count: 4},
    patern: [
      [null, null],
      [null, 'cedar-log']
      ]
  },
  {
    output: { item: 'birch-planks', count: 4},
    patern: [
      [null, null],
      [null, 'birch-log']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    pattern: [
      [null, 'maple-planks'],
      [null, 'maple-planks']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    patern: [
      [null, 'pine-planks.block'],
      [null, 'pine-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    patern: [
      [null, 'oak-planks.block'],
      [null, 'oak-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    patern: [
      [null, 'cedar-planks.block'],
      [null, 'cedar-planks.block']
      ]
  },
  {
    output: { item: 'stick', count: 16},
    patern: [
      [null, 'birch-planks.block'],
      [null, 'birch-planks.block']
      ]
  },
  {
    output: { item: 'stick.block', count: 1},
    patern: [
      ['stick', 'stick', 'stick'],
      ['stick', 'stick', 'stick'],
      ['stick', 'stick', 'stick']
      ]
  },
  {
    output: { item: 'coal.block', count: 1},
    patern: [
      ['coal', 'coal', 'coal'],
      ['coal', 'coal', 'coal'],
      ['coal', 'coal', 'coal']
      ]
  },
  {
    output: { item: 'copper.block', count: 1},
    patern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'copper-bar', 'copper-bar']
      ]
  },
  {
    output: { item: 'tin.block', count: 1},
    patern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar']
      ]
  },
  {
    output: { item: 'bronze.block', count: 1},
    patern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar']
      ]
  },
  {
    output: { item: 'iron.block', count: 1},
    patern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar']
      ]
  },
  {
    output: { item: 'steel.block', count: 1},
    patern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar']
      ]
  },
  {
    output: { item: 'diamond.block', count: 1},
    patern: [
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'diamond', 'diamond'],
      ]
  },
  {
    output: { item: 'amber.block', count: 1},
    patern: [
      ['amber-chunk', 'amber-chunk', 'amber-chunk'],
      ['amber-chunk', 'amber-chunk', 'amber-chunk'],
      ['amber-chunk', 'amber-chunk', 'amber-chunk']
      ]
  },
  {
    output: { item: 'ruby.block', count: 1},
    patern: [
      ['ruby', 'ruby', 'ruby'],
      ['ruby', 'ruby', 'ruby'],
      ['ruby', 'ruby', 'ruby'],
      ]
  },
  {
    output: { item: 'saw', count: 1},
    patern: [
     [null, 'iron-bar', null],
     ['iron-bar', null, 'iron-bar'],
     [null, 'iron-bar', null]
     ]
  },
  {
    output: { item: 'maple-cutting-station.block', count: 1},
    patern: [
      [null, 'saw'],
      [null, 'maple-crafting-station.block']
      ]
  },
  {
    output: { item: 'pine-cutting-station.block', count: 1},
    patern: [
      [null, 'saw'],
      [null, 'pine-cafting-station.block']
      ]
  },
  {
    output: { item: 'oak-cutting-station.block', count: 1},
    patern: [
      [null, 'saw'],
      [null, 'oak-crafting-station.block']
      ]
  },
  {
    output: { item: 'cedar-cutting-station.block', count: 1},
    patern: [
      [null, 'saw'],
      [null, 'cedar-crafting-station.block']
      ]
  },
  {
    output: { item: 'birch-cutting-station.block', count: 1},
    patern: [
      [null, 'saw'],
      [null, 'birch-crafting-station']
      ]
  },
  {
    output: { item: 'maple-chisel', count: 1},
    patern: [
      [null, 'iron-bar'],
      [null, 'maple-planks.block']
      ]
  },
  {
    output: { item: 'pine-chisel', count: 1},
    patern: [
      [null, 'iron-bar'],
      [null, 'pine-planks.block']
      ]
  },
  {
    output: { item: 'oak-chisel', count: 1},
    patern: [
      [null, 'iron-bar'],
      [null, 'oak-planks.block']
      ]
  },
  {
    output: { item: 'cedar-chisel', count: 1},
    patern: [
      [null, 'iron-bar'],
      [null, 'cedar-planks.block']
      ]
  },
  {
    output: { item: 'birch-chisel', count: 1},
    patern: [
      [null, 'iron-bar'],
      [null, 'birch-planks.block']
      ]
  },
  {
    output: { item: 'maple-engraving-station.block', count: 1},
    patern: [
      [null, 'maple-chisel'],
      [null, 'maple-crafting-station.block']
      ]
  },
  {
    output: { item: 'pine-engraving-station.block', count: 1},
    patern: [
      [null, 'pine-chisel'],
      [null, 'pine-crafting-station.block']
      ]
  },
  {
    output: { item: 'oak-engraving-station.block', count: 1},
    patern: [
      [null, 'oak-chisel'],
      [null, 'oak-crafting-station.block']
      ]
  },
  {
    output: { item: 'cedar-engraving-station.block', count: 1},
    patern: [
      [null, 'cedar-chisel'],
      [null, 'cedar-crafting-station.block']
      ]
  },
  {
    output: { item: 'birch-engraving-station.block', count: 1},
    patern: [
      [null, 'birch-chisel'],
      [null, 'birch-crafting-station.block']
      ]
  },
  {
    output: { item: 'plate', count: 1},
    patern: [
      [null, 'copper-bar', null],
      ['copper-bar', null, 'copper-bar'],
      [null, 'copper-bar', null]
      ]
  },
  {
    output: { item: 'maple-cooking-station', count: 1},
    patern: [
      [null, 'plate'],
      [null, 'maple-crafting-station']
      ]
  },
  {
    output: { item: 'pine-cooking-station', count: 1},
    patern: [
      [null, 'plate'],
      [null, 'pine-crafting-station']
      ]
  },
  {
    output: { item: 'oak-cooking-station', count: 1},
    patern: [
      [null, 'plate'],
      [null, 'oak-crafting-station']
      ]
  },
  {
    output: { item: 'cedar-cooking-station', count: 1},
    patern: [
      [null, 'plate'],
      [null, 'cedar-crafting-station']
      ]
  },
  {
    output: { item: 'birch-cooking-station', count: 1},
    patern: [
      [null, 'plate'],
      [null, 'birch-crafting-station']
      ]
  },
  {
    output: { item: 'bowl', count: 1},
    patern: [
      [null, null, null,],
      ['copper-bar', null, 'copper-bar'],
      [null, 'copper-bar', null]
      ]
  },
  {
    output: { item: 'smelting-station', count: 1},
    patern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block']
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    patern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    patern: [
      ['pine-planks.block', 'pine-planks.block', 'pine-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    patern: [
      ['oak-planks.block', 'oak-planks.block', 'oak-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    patern: [
      ['cedar-planks.block', 'cedar-planks.block', 'cedar-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-pickaxe', count: 1},
    patern: [
      ['birch-planks.block', 'birch-planks.block', 'birch-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-pickaxe', count: 1},
    patern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-pickaxe', count: 1},
    patern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-pickaxe', count: 1},
    patern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-pickaxe', count: 1},
    patern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-pickaxe', count: 1},
    patern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-pickaxe', count: 1},
    patern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-pickaxe', count: 1},
    patern: [
      ['diamond', 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-pickaxe', count: 1},
    patern: [
      ['copper.block', 'copper.block', 'copper.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-pickaxe', count: 1},
    patern: [
      ['tin.block', 'tin.block', 'tin.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-pickaxe', count: 1},
    patern: [
      ['bronze.block', 'bronze.block', 'bronze.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-pickaxe', count; 1},
    patern: [
      ['iron.block', 'iron.block', 'iron.bock'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-pickaxe', count: 1},
    patern: [
      ['steel.block', 'steel.block', 'steel.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-pickaxe', count: 1},
    patern: [
      ['diamond.block', 'diamond.block', 'diamond.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    patern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    patern: [
      [null, 'pine-planks.block', null],
      [null, 'pine-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    patern: [
      [null, 'oak-planks.block', null],
      [null, 'oak-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    patern: [
      [null, 'cedar-planks.block', null],
      [null, 'cedar-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-sword', count: 1},
    patern: [
      [null, 'birch-planks.block', null],
      [null, 'birch-planks.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-sword', count: 1},
    patern: [
      [null, 'cobblestone.block', null],
      [null, 'cobblestone.block', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-sword', count: 1},
    patern: [
      [null, 'copper-bar', null],
      [null, 'copper-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-sword', count: 1},
    patern: [
      [null, 'tin-bar', null],
      [null, 'tin-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-sword', count: 1},
    patern: [
      [null, 'bronze-bar', null],
      [null, 'bronze-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-sword', count: 1},
    patern: [
      [null, 'iron-bar', null],
      [null, 'iron-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-sword', count; 1},
    patern: [
      [null, 'steel-bar', null],
      [null, 'steel-bar', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-sword', count: 1},
    patern: [
      [null, 'diamond', null],
      [null, 'diamond', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-sword', count: 1},
    patern: [
      [null, 'copper.block', null],
      [null, 'copper.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-sword', count: 1},
    patern: [
      [null, 'tin.block', null],
      [null, 'tin.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-sword', count: 1},
    patern: [
      [null, 'bronze.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-sword', count: 1},
    patern: [
      [null, 'iron.block', null],
      [null, 'iron.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-sword', count: 1},
    patern: [
      [null, 'steel.block', null],
      [null, 'steel.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-sword', count: 1},
    patern: [
      [null, 'diamond.block', null],
      [null, 'diamond.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-tip', count: 1},
    patern: [
      [null, 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-midsection', count: 1},
    patern: [
      [null, 'dragon-scale', null],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      [null, 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade-base', count: 1},
    patern: [
      [null, 'dragon-scale', null],
      ['dragon-scale', 'dragon-scale', 'dragon-scale'],
      ['dragon-scale', 'dragon-scale', null]
      ]
  },
  {
    output: { item: 'dragon-sword-blade', count: 1},
    patern: [
      [null, null, 'dragon-sword-blade-tip'],
      [null, 'dragon-sword-blade-midsection', null],
      ['dragon-sword-blade-base', null, null]
      ]
  },
  {
    output: { item: 'dragon-sword-handle', count: 1},
    patern: [
      ['stick', null, 'amber-chunk'],
      [null, 'ruby', null],
      ['stick', null, 'stick']
      ]
  },
  {
    output: { item: 'dragon-sword', count: 1},
    patern: [
      [null, 'dragon-sword-blade'],
      ['dragon-sword-handle', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-tip', count: 1},
    patern: [
      [null, 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-midsection', count: 1},
    patern: [
      [null, 'dragon-scale.block', null],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      [null, 'dragon-scale.block', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-blade-base', count: 1},
    patern: [
      [null, 'dragon-scale.block', null],
      ['dragon-scale.block', 'dragon-scale.block', 'dragon-scale.block'],
      ['dragon-scale.block', 'dragon-scale.block', null]
  {
    output: { item: 'absolute-unit-sword-blade', count: 1},
    patern: [
      [null, null, 'absolute-unit-sword-blade-tip'],
      [null, 'absolute-unit-sword-blade-midsection', null],
      ['absolute-unit-sword-blade-base', null]
      ]
  },
  {
    output: { item: 'absolute-unit-sword-handle', count: 1},
    patern: [
      ['stick.block', null, 'amber.block'],
      [null, 'ruby.block', null],
      ['stick.block', null, 'stick.block']
      ]
  },
  {
    output: { item: 'absolute-unit-sword', count: 1},
    patern: [
      [null, 'absolute-unit-sword-blade'],
      ['absolute-unit-sword-handle', null]
      ]
  },
  {
    output: { item: 'wood-axe', count: 1},
    patern: [
      [null, 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', 'maple-planks.block'],
      [null, 'stick', 'stick']
      ]
  },
  {
    output: { item: 'stone-axe', count: 1},
    patern: [
      [null, 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', 'cobblestone'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-axe', count: 1},
    patern: [
      [null, 'copper-bar', 'copper-bar'],
      [null, 'stick', 'copper-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-axe', count: 1},
    patern: [
      [null, 'tin-bar', 'tin-bar'],
      [null, 'stick', 'tin-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-axe', count: 1},
    patern: [
      [null, 'bronze-bar', 'bronze-bar'],
      [null, 'stick', 'bronze-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-axe', count: 1},
    patern: [
      [null, 'iron-bar', 'iron-bar'],
      [null, 'stick', 'iron-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-axe', count: 1},
    patern: [
      [null, 'steel-bar', 'steel-bar'],
      [null, 'stick', 'steel-bar'],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-axe', count: 1},
    patern: [
      [null, 'diamond', 'diamond'],
      [null, 'stick', 'diamond'],
      [null, 'stick', null]
  {
    output: { item: 'solid-copper-axe', count: 1},
    patern: [
      [null, 'copper.block', 'copper.block'],
      [null, 'stick.block', 'copper.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'soid-tin-axe', count: 1},
    patern: [
      [null, 'tin.block', 'tin.block'],
      [null, 'stick.block', 'tin.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-axe', count: 1},
    [null, 'bronze.block', 'bronze.block'],
    [null, 'stick.block', 'bronze.block'],
    [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-axe', count: 1},
    patern: [
      [null, 'iron.block', 'iron.block'],
      [null, 'stick.block', 'iron.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-axe', count: 1},
    patern: [
      [null, 'steel.block', 'steel.block'],
      [null, 'stick.block', 'steel.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-axe', count: 1},
    patern: [
      [null, 'diamond.block', 'diamond.block'],
      [null, 'stick.block', 'diamond.block'],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    patern: [
      [null, 'maple-planks.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    patern: [
      [null, 'pine-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    patern: [
      [null, 'oak-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    patern: [
      [null, 'cedar-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-shovel', count: 1},
    patern: [
      [null, 'birch-planks.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-shovel', count: 1},
    patern: [
      [null, 'cobblestone.block', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-shovel', count: 1},
    patern: [
      [null, 'copper-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'tin-shovel', count: 1},
    patern: [
      [null, 'tin-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-shovel', count: 1},
    patern: [
      [null, 'bronze-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-shovel', count: 1},
    patern: [
      [null, 'iron-bar', null'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-shovel', count: 1},
    patern: [
      [null, 'steel-bar', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-shovel', count: 1},
    patern: [
      [null, 'diamond', null],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-shovel', count: 1},
    patern: [
      [null, 'copper.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-shovel', count: 1},
    patern: [
      [null, 'tin.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
  {
    output: { item: 'solid-bronze-shovel', count: 1},
    patern: [
      [null, 'bronze.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-shovel', count: 1},
    patern: [
      [null, 'iron.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-shovel', count: 1},
    patern: [
      [null, 'steel.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-shovel', count: 1},
    patern: [
      [null, 'diamond.block', null],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    patern: [
      [null, 'maple-planks.block', 'maple-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    patern: [
      [null, 'pine-planks.block', 'pine-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    patern: [
      [null, 'oak-planks.block', 'oak-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    patern: [
      [null, 'cedar-planks.block', 'cedar-planks.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'wood-hoe', count: 1},
    patern: [
      [null, 'birch-planks.block', 'birch-planks.block']
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'stone-hoe', count: 1},
    patern: [
      [null, 'cobblestone.block', 'cobblestone.block'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'copper-hoe', count: 1},
    patern: [
      [null, 'copper-bar', 'copper-bar'],
      [null, 'stick', null],
      [null, 'stick' null]
      ]
  },
  {
    output: { item: 'tin-hoe', count: 1},
    patern: [
      [null, 'tin-bar', 'tin-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'bronze-hoe', count: 1},
    patern: [
      [null, 'bronze-bar', 'bronze-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'iron-hoe', count: 1},
    patern: [
      [null, 'iron-bar', 'iron-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'steel-hoe', count: 1},
    patern: [
      [null, 'steel-bar', 'steel-bar'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'diamond-hoe', count: 1},
    patern: [
      [null, 'diamond', 'diamond'],
      [null, 'stick', null],
      [null, 'stick', null]
      ]
  },
  {
    output: { item: 'solid-copper-hoe', count: 1},
    patern: [
      [null, 'copper.block', 'copper.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-tin-hoe', count: 1},
    patern: [
      [null, 'tin.block', 'tin.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-bronze-hoe', count: 1},
    patern: [
      [null, 'bronze.block', 'bronze.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-iron-hoe', count: 1},
    patern: [
      [null, 'iron.block', 'iron.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-steel-hoe', count: 1},
    patern: [
      [null, 'steel.block', 'steel.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'solid-diamond-hoe', count: 1},
    patern: [
      [null, 'diamond.block', 'diamond.block'],
      [null, 'stick.block', null],
      [null, 'stick.block', null]
      ]
  },
  {
    output: { item: 'maple-locker.block', count: 1},
    patern: [
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block'],
      ['maple-planks.block', null, 'maple-planks.block'],
      ['maple-planks.block', 'maple-planks.block', 'maple-planks.block']
      ]
  },
  {
    output: { item: 'stone-locker.block', count: 1},
    patern: [
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block'],
      ['cobblestone.block', 'maple-locker.block', 'cobblestone.block'],
      ['cobblestone.block', 'cobblestone.block', 'cobblestone.block']
      ]
  },
  {
    output: { item: 'copper-locker.block', count: 1},
    patern: [
      ['copper-bar', 'copper-bar', 'copper-bar'],
      ['copper-bar', 'stone-locker.block', 'copper.block'],
      ['copper-bar', 'copper-bar', 'copper-bar']
      ]
  },
  {
    output: { item: 'tin-locker.block', count: 1},
    patern: [
      ['tin-bar', 'tin-bar', 'tin-bar'],
      ['tin-bar', 'copper-locker.block', 'tin-bar'],
      ['tin-bar', 'tin-bar', 'tin-bar']
      ]
  },
  {
    output: { item: 'bronze-locker.block', count: 1},
    patern: [
      ['bronze-bar', 'bronze-bar', 'bronze-bar'],
      ['bronze-bar', 'tin-locker.block', 'bronze-bar'],
      ['bronze-bar', 'bronze-bar', 'bronze-bar']
      ]
  },
  {
    output: { item: 'iron-locker.block', count: 1},
    patern: [
      ['iron-bar', 'iron-bar', 'iron-bar'],
      ['iron-bar', 'bronze-locker.block', 'iron-bar'],
      ['iron-bar', 'iron-bar', 'iron-bar']
      ]
  },
  {
    output: { item: 'steel-locker.block', count: 1},
    patern: [
      ['steel-bar', 'steel-bar', 'steel-bar'],
      ['steel-bar', 'iron-locker.block', 'steel-bar'],
      ['steel-bar', 'steel-bar', 'steel-bar']
      ]
  },
  {
    output: { item: 'diamond-locker.block', count: 1},
    patern: [
      ['diamond', 'diamond', 'diamond'],
      ['diamond', 'steel-locker.block', 'diamond'],
      ['diamond', 'diamond', 'diamond']
      ]
  },
    ];
const smeltingRecipes = [
  {
    input: [
      ['copper-ore.block', null],
      [null, null]
      ],
    output: [
      ['copper-bar', null],
      [null, null]
      ],
      time: 5
  },
  {
    input: [
      ['tin-ore.block', null],
      [null, null]
      ],
    output: [
      ['tin-bar', null],
      [null, null]
      ],
    time: 5
  },
  ];
      
const cuttingRecipes = {
  'maple-planks': [
    {
      item: 'maple-planks.slab',
      count: 2
    },
    {
      items: [
        { item: 'maple-planks.large-stairs', count: 1},
        { item: 'maple-planks.small-stairs', count: 1}
        ]
    },
    {
      item: 'maple-planks.small-stairs',
      count: 4
    },
    ]
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
    output: { item: 'dough', count: 1},
    patern: [
      [null, null],
      ['wheat', 'water-bucket']
      ]
  },
  {
    output: { item: 'loaf', count: 1},
    patern: [
      [null, null],
      [null, 'dough']
      ]
  },
  {
    output: { item: 'noodles', count: 1},
    patern: [
      [null, null],
      ['dough', 'dough']
      ]
  },
  {
    output: { item: 'spagheti', count: 1},
    patern: [
      ['noodles', 'tomato'],
      ['plate', null]
      ]
  },
  {
    output: { item: 'soup', count: 1},
    patern: [
      ['tomato', 'potato'],
      ['bowl', 'carrot']
      ]
  },
  {
    output: { item: 'pumpkin-pie', count: 1},
    patern: [
      ['pumpkin', 'dough'],
      [null, null]
      ]
  },
  {
    output: { item: 'bread', count: 8},
    patern: [
      [null, null],
      [null, 'loaf']
      ]
  },
  {
    output: { item: 'sandwich', count: 1},
    patern: [
      ['bread', 'tomato'],
      ['tomato', 'bread'],
      ]
  },
  {
    output: { item: 'pancakes', count: 1},
    patern: [
      ['dough', null],
      ['plate', null]
      ]
  },
  {
    output: { item: 'pancakes-with-syrup', count: 1},
    patern: [
      ['bucket-of-syrup', null],
      ['pancakes', null]
      ]
  }
  ];

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
function updatePlayerPosition(){
  let forward=0,right=0;
  if(keys['w']) forward+=1;
  if(keys['s']) forward-=1;
  if(keys['d']) right+=1;
  if(keys['a']) right-=1;
  const rad=yaw*Math.PI/180;
  posX+=(forward*Math.cos(rad)-right*Math.sin(rad))*speed;
  posZ+=(forward*Math.sin(rad)+right*Math.cos(rad))*speed;

  velY+=gravity;
  posY+=velY;

  const surface=getTopSurfaceYUnderPlayer();
  const playerFeetY=posY-characterYOffset;
  if(surface!==undefined){
    if(playerFeetY>surface){
      posY=surface+characterYOffset;
      velY=0;
      grounded=true;
    } else grounded=false;
  } else {
    if(posY>STONE_LAYERS*BLOCK_SIZE+characterYOffset){
      posY=STONE_LAYERS*BLOCK_SIZE+characterYOffset;
      velY=0;
      grounded=true;
    } else grounded=false;
  }
}

// === Transforms (camera = eyes) ===
function updateTransforms(){
  const camX=posX - Math.sin(yaw*Math.PI/180)*200;
  const camZ=posZ - Math.cos(yaw*Math.PI/180)*200;
  const camY=(posY - characterYOffset) + eyeHeight; // camera at eyes
  console.log(`Player elevation (feet Y): ${(posY-characterYOffset).toFixed(2)}`);

  const sceneTransform=`
    rotateX(${pitch}deg)
    rotateY(${yaw}deg)
    translate3d(${-camX}px,${-camY}px,${-camZ}px)
  `;
  const playerTransform=`
    translate3d(${posX}px,${posY-characterYOffset}px,${posZ}px)
    rotateY(${yaw}deg)
  `;
  if(sceneTransform!==lastSceneTransform){scene.style.transform=sceneTransform;lastSceneTransform=sceneTransform;}
  if(playerTransform!==lastPlayerTransform){playerModel.style.transform=playerTransform;lastPlayerTransform=playerTransform;}
}

// === Game loop ===
function animate(){
  updatePlayerPosition();
  updateTransforms();
  requestAnimationFrame(animate);
}

// === Start ===
generateMultiLayerWorld();
createCharacter();
console.log('World generated. Starting posY:', posY,'groundY:',groundY);
animate();
