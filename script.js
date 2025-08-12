console.log("Script running");

// === Constants ===
const BLOCK_SIZE = 70; // permanent block size in pixels
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 80; // max depth

// === Game setup ===
const playerModel = document.getElementById("player-model");
const cameraYaw = document.getElementById("camera-yaw");
const cameraPitch = document.getElementById("camera-pitch");
const cameraEye = document.getElementById("camera-eye");
const scene = document.getElementById("scene");
const world = document.getElementById("world");

let posX = 0;
let posY = 0;
let posZ = 0;
let velocityY = 0;
let onGround = false;

// === World Data ===
let blocks = {}; // { `${x},${y},${z}`: blockType }

// === Terrain Generation ===
function generateWorld() {
    for (let x = -CHUNK_SIZE; x < CHUNK_SIZE; x++) {
        for (let z = -CHUNK_SIZE; z < CHUNK_SIZE; z++) {
            // Grass layer
            setBlock(x, 0, z, "grass");

            // Dirt layers (2–3 deep)
            let dirtDepth = 2 + Math.floor(Math.random() * 2);
            for (let y = 1; y <= dirtDepth; y++) {
                setBlock(x, y, z, "dirt");
            }

            // Stone down to 80 blocks deep
            for (let y = dirtDepth + 1; y < WORLD_HEIGHT; y++) {
                setBlock(x, y, z, "stone");
            }
        }
    }

    // Ore veins
    generateOre("coal-ore", 1, 15, 2, 15);
    generateOre("copper-ore", 10, 20, 2, 10);
    generateOre("tin-ore", 10, 20, 2, 10);
    generateOre("iron-ore", 20, 35, 2, 7);
    generateOre("diamond-ore", 35, 50, 1, 4);
    generateOre("amber-ore", 50, 80, 1, 1);
    generateOre("ruby-ore", 50, 80, 1, 1);

    renderWorld();
}

function generateOre(type, minDepth, maxDepth, veinsPerChunk, veinSize) {
    for (let i = 0; i < veinsPerChunk * CHUNK_SIZE; i++) {
        let oreX = Math.floor(Math.random() * CHUNK_SIZE * 2) - CHUNK_SIZE;
        let oreZ = Math.floor(Math.random() * CHUNK_SIZE * 2) - CHUNK_SIZE;
        let oreY = minDepth + Math.floor(Math.random() * (maxDepth - minDepth));

        for (let j = 0; j < veinSize; j++) {
            let offsetX = oreX + Math.floor(Math.random() * 3) - 1;
            let offsetY = oreY + Math.floor(Math.random() * 3) - 1;
            let offsetZ = oreZ + Math.floor(Math.random() * 3) - 1;
            let key = `${offsetX},${offsetY},${offsetZ}`;
            if (blocks[key] === "stone") {
                setBlock(offsetX, offsetY, offsetZ, type);
            }
        }
    }
}

function setBlock(x, y, z, type) {
    blocks[`${x},${y},${z}`] = type;
}

function renderWorld() {
    for (let key in blocks) {
        let [x, y, z] = key.split(",").map(Number);
        let block = document.createElement("div");
        block.className = `block ${blocks[key]}`;
        block.style.transform = `translate3d(${x * BLOCK_SIZE}px, ${-y * BLOCK_SIZE}px, ${z * BLOCK_SIZE}px)`;
        world.appendChild(block);
    }
}

// === Find Topmost Block at X,Z ===
function getTopBlockY(x, z) {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
        if (blocks[`${x},${y},${z}`]) {
            return y;
        }
    }
    return 0;
}

// === Player Setup ===
function spawnPlayer() {
    let topY = getTopBlockY(0, 0);
    posY = -(topY * BLOCK_SIZE + BLOCK_SIZE * 3); // 3 blocks above top
    updatePlayerPosition();
    console.log(`Player spawned at Y=${posY}`);
}

// === Movement & Physics ===
function updatePlayerPosition() {
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraEye.style.transform = `translate3d(0px, ${posY}px, 0px)`;
    console.log(`Character elevation: ${-posY / BLOCK_SIZE} blocks`);
}

function gameLoop() {
    velocityY += 2; // gravity
    posY += velocityY;

    // Simple collision: stop at top block
    let topY = getTopBlockY(0, 0) * -BLOCK_SIZE;
    if (posY > topY) {
        posY = topY;
        velocityY = 0;
        onGround = true;
    } else {
        onGround = false;
    }

    updatePlayerPosition();
    requestAnimationFrame(gameLoop);
}

// === Init ===
generateWorld();
spawnPlayer();
gameLoop();
