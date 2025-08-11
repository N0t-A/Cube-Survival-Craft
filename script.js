console.log("Script running...");

// === Config / constants ===
const BLOCK_SIZE = 70;         
const CHUNK_SIZE_X = 10;       
const CHUNK_SIZE_Z = 10;       
const STONE_LAYERS = 80;       
const eyeHeight = 120;         
const characterYOffset = 280;  

// === Player state ===
let posX = 0;
let posY = 0; 
let posZ = 0;
let yaw = 0, pitch = 0;
let velocityY = 0;
let onGround = false;

// === Elements ===
const scene = document.getElementById("scene");
const cameraYaw = document.getElementById("camera-yaw");
const cameraPitch = document.getElementById("camera-pitch");
const cameraEye = document.getElementById("camera-eye");

// === World data ===
const blocks = {};

// Pointer lock request
scene.addEventListener("click", () => {
    scene.requestPointerLock();
});

// Pointer lock change debug
document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

// Mouse look
document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === scene) {
        yaw += e.movementX * 0.1;   
        pitch -= e.movementY * 0.1; 
        pitch = Math.max(-89, Math.min(89, pitch)); 
    }
});

// Ore vein generator
function generateVeins(oreType, minDepth, maxDepth, veinsPerChunk, veinSize) {
    for (let v = 0; v < veinsPerChunk; v++) {
        const startX = Math.floor(Math.random() * CHUNK_SIZE_X);
        const startZ = Math.floor(Math.random() * CHUNK_SIZE_Z);
        const startY = Math.floor(Math.random() * (maxDepth - minDepth + 1)) + minDepth;

        for (let i = 0; i < veinSize; i++) {
            const offsetX = startX + Math.floor(Math.random() * 3) - 1;
            const offsetZ = startZ + Math.floor(Math.random() * 3) - 1;
            const offsetY = startY + Math.floor(Math.random() * 3) - 1;

            const key = `${offsetX},${offsetY},${offsetZ}`;
            if (blocks[key] && blocks[key].type === "stone") {
                blocks[key].type = oreType;
            }
        }
    }
}

function createBlockElement(x, y, z, type) {
    const block = document.createElement("div");
    block.className = `block ${type}`;
    block.style.transform = `translate3d(${x * BLOCK_SIZE}px, ${-(y * BLOCK_SIZE)}px, ${z * BLOCK_SIZE}px)`;
    scene.appendChild(block);
}

function generateChunk() {
    for (let x = 0; x < CHUNK_SIZE_X; x++) {
        for (let z = 0; z < CHUNK_SIZE_Z; z++) {
            for (let y = 0; y <= STONE_LAYERS; y++) {
                let type;
                if (y === 0) type = "grass";
                else if (y <= 3) type = "dirt";
                else type = "stone";

                const key = `${x},${y},${z}`;
                blocks[key] = { type };
            }
        }
    }

    generateVeins("coal-ore", 1, 15, 2, 15);
    generateVeins("copper-ore", 10, 20, 2, 10);
    generateVeins("tin-ore", 10, 20, 2, 10);
    generateVeins("iron-ore", 20, 35, 2, 7);
    generateVeins("diamond-ore", 35, 50, 1, 4);
    generateVeins("amber-ore", 50, 80, 1, 1);
    generateVeins("ruby-ore", 50, 80, 1, 1);

    for (const key in blocks) {
        const [x, y, z] = key.split(",").map(Number);
        createBlockElement(x, y, z, blocks[key].type);
    }
}

function createCharacter() {
    const player = document.createElement("div");
    player.id = "player-model";
    player.style.transform = `translate3d(0px, ${-(posY * BLOCK_SIZE + characterYOffset)}px, 0px)`;

    const parts = [
        { id: "legs", height: 50, y: 0 },
        { id: "torso", height: 60, y: -50 },
        { id: "head", height: 20, y: -110 }
    ];

    parts.forEach(part => {
        const div = document.createElement("div");
        div.className = `part ${part.id}`;
        div.style.height = `${part.height}px`;
        div.style.transform = `translateY(${part.y}px)`;

        ["front", "back", "left", "right", "top", "bottom"].forEach(face => {
            const faceDiv = document.createElement("div");
            faceDiv.className = `face ${face}`;
            div.appendChild(faceDiv);
        });

        player.appendChild(div);
    });

    scene.appendChild(player);
}

function checkCollision(newY) {
    const footY = Math.floor(newY / BLOCK_SIZE);
    const blockBelow = blocks[`0,${footY},0`];
    return blockBelow && blockBelow.type !== undefined;
}

function updatePhysics() {
    velocityY -= 0.98;

    let newY = posY + velocityY * 0.1;
    if (velocityY < 0 && checkCollision(newY)) {
        onGround = true;
        velocityY = 0;
        newY = Math.floor(newY / BLOCK_SIZE) * BLOCK_SIZE;
    } else {
        onGround = false;
    }

    posY = newY;
}

function updateCamera() {
    cameraYaw.style.transform = `rotateY(${yaw}deg)`;
    cameraPitch.style.transform = `rotateX(${pitch}deg)`;
    cameraEye.style.transform = `translate3d(${posX}px, ${-(posY + eyeHeight)}px, ${posZ}px)`;
}

function gameLoop() {
    updatePhysics();
    updateCamera();
    requestAnimationFrame(gameLoop);
}

generateChunk();
createCharacter();
gameLoop();
