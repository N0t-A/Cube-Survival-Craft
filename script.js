console.log("Script running");

// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player position ===
let posX = 0;
let posY = -200; // starting above ground
let posZ = 0;
let velY = 0;
const gravity = 2;
const jumpStrength = -70; // inverted Y-axis

// === Pointer Lock Setup ===
document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === document.body) {
        console.log("Pointer lock on");
    } else {
        console.log("Pointer lock off");
    }
});
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body) {
        cameraYaw.style.transform += ` rotateY(${e.movementX * 0.1}deg)`;
        cameraPitch.style.transform += ` rotateX(${-e.movementY * 0.1}deg)`;
    }
});

// === Create Character ===
function createCharacter() {
    const parts = [
        { className: 'legs', height: 50, y: 80 },
        { className: 'torso', height: 60, y: 30 },
        { className: 'head', height: 20, y: 10 }
    ];

    parts.forEach(part => {
        const partEl = document.createElement('div');
        partEl.className = `char-part ${part.className}`;
        partEl.style.height = part.height + 'px';
        partEl.style.transform = `translateY(${part.y}px)`;
        playerModel.appendChild(partEl);
    });
}
createCharacter();

// === Terrain Generation ===
function generateChunk() {
    const chunkSize = 16;
    const blockSize = 40;
    const grassHeight = -40;
    const dirtLayers = 3;
    const stoneDepth = 80;

    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            // Grass layer
            createBlock("grass", x * blockSize, grassHeight, z * blockSize);

            // Dirt layers
            for (let y = 1; y <= dirtLayers; y++) {
                createBlock("dirt", x * blockSize, grassHeight + (y * blockSize), z * blockSize);
            }

            // Stone layers
            for (let y = dirtLayers + 1; y <= stoneDepth; y++) {
                createBlock("stone", x * blockSize, grassHeight + (y * blockSize), z * blockSize);
            }
        }
    }
}

function createBlock(type, x, y, z) {
    const block = document.createElement('div');
    block.className = `block ${type}`;
    block.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
    world.appendChild(block);
}

generateChunk();

// === Collision Detection ===
function isOnGround() {
    const feetY = posY + 130; // character height
    const blocks = document.querySelectorAll('.block');
    for (let block of blocks) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(block).transform);
        const blockY = matrix.m42;
        if (Math.abs(blockY - feetY) < gravity) {
            return true;
        }
    }
    return false;
}

// === Game Loop ===
function gameLoop() {
    // Log elevation
    console.log("Character elevation (posY):", posY);

    // Gravity
    if (!isOnGround()) {
        velY += gravity;
        posY += velY;
    } else {
        velY = 0;
    }

    // Update character position
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraEye.style.transform = `translate3d(0px, ${posY - 120}px, 0px)`;

    requestAnimationFrame(gameLoop);
}
gameLoop();
