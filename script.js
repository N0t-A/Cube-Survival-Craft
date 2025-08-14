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
