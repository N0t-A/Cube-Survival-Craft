console.log("Script running");

// === Game setup ===
const playerModel = document.getElementById("player-model");
const cameraYaw = document.getElementById("camera-yaw");
const cameraPitch = document.getElementById("camera-pitch");
const cameraEye = document.getElementById("camera-eye");
const scene = document.getElementById("scene");
const world = document.getElementById("world");

const BLOCK_SIZE = 50;
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 80; // max depth

// === Pointer Lock Debug ===
scene.addEventListener("click", () => {
    console.log("Scene clicked, requesting pointer lock...");
    if (scene.requestPointerLock) {
        scene.requestPointerLock();
    } else {
        console.warn("Pointer lock API not supported in this browser.");
    }
});

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

document.addEventListener("pointerlockerror", () => {
    console.error("Pointer lock request failed.");
});

// === Mouse Movement ===
document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === scene) {
        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        // Adjust yaw and pitch
        cameraYaw.style.transform += ` rotateY(${movementX * 0.1}deg)`;
        cameraPitch.style.transform += ` rotateX(${-movementY * 0.1}deg)`;
    }
});

// === Player Position ===
let posX = 0;
let posY = -BLOCK_SIZE * 3; // Offset: 3 blocks above ground
let posZ = 0;

// === Generate a Chunk ===
function generateChunk(chunkX, chunkZ) {
    const fragment = document.createDocumentFragment();

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX * CHUNK_SIZE + x;
            const worldZ = chunkZ * CHUNK_SIZE + z;

            // Ground layer setup
            for (let y = 0; y < WORLD_HEIGHT; y++) {
                let blockType = null;

                if (y === 0) {
                    blockType = "grass";
                } else if (y > 0 && y <= 3) {
                    blockType = "dirt";
                } else {
                    blockType = "stone";
                }

                const block = document.createElement("div");
                block.className = `block ${blockType}`;
                block.style.transform = `translate3d(${worldX * BLOCK_SIZE}px, ${y * BLOCK_SIZE}px, ${worldZ * BLOCK_SIZE}px)`;
                fragment.appendChild(block);
            }
        }
    }

    // === Ore Generation ===
    generateOre(fragment, chunkX, chunkZ, "coal-ore", 1, 15, 2, 15);
    generateOre(fragment, chunkX, chunkZ, "copper-ore", 10, 20, 2, 10);
    generateOre(fragment, chunkX, chunkZ, "tin-ore", 10, 20, 2, 10);
    generateOre(fragment, chunkX, chunkZ, "iron-ore", 20, 35, 2, 7);
    generateOre(fragment, chunkX, chunkZ, "diamond-ore", 35, 50, 1, 4);
    generateOre(fragment, chunkX, chunkZ, "amber-ore", 50, 80, 1, 1);
    generateOre(fragment, chunkX, chunkZ, "ruby-ore", 50, 80, 1, 1);

    world.appendChild(fragment);
}

// === Ore Vein Generator ===
function generateOre(fragment, chunkX, chunkZ, oreType, minDepth, maxDepth, veinsPerChunk, veinSize) {
    for (let v = 0; v < veinsPerChunk; v++) {
        const startX = chunkX * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);
        const startY = minDepth + Math.floor(Math.random() * (maxDepth - minDepth + 1));
        const startZ = chunkZ * CHUNK_SIZE + Math.floor(Math.random() * CHUNK_SIZE);

        for (let i = 0; i < veinSize; i++) {
            const offsetX = startX + Math.floor(Math.random() * 3) - 1;
            const offsetY = startY + Math.floor(Math.random() * 3) - 1;
            const offsetZ = startZ + Math.floor(Math.random() * 3) - 1;

            const block = document.createElement("div");
            block.className = `block ${oreType}`;
            block.style.transform = `translate3d(${offsetX * BLOCK_SIZE}px, ${offsetY * BLOCK_SIZE}px, ${offsetZ * BLOCK_SIZE}px)`;
            fragment.appendChild(block);
        }
    }
}

// === Generate World ===
for (let cx = 0; cx < 2; cx++) {
    for (let cz = 0; cz < 2; cz++) {
        generateChunk(cx, cz);
    }
}

// === Position Player ===
playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
cameraEye.style.transform = `translate3d(0px, ${posY - 120}px, 0px)`;
