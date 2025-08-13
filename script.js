console.log("Script running");

// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

let posX = 0;
let posZ = 0;

// === Corrected Player Spawn Position ===
// Block size in pixels
const blockSize = 70;

// Ground Y in pixels
const groundLevelYPixels = -40; // Grass layer is here
// Convert ground Y to blocks
const groundLevelYBlocks = groundLevelYPixels / blockSize;

// Character height in pixels
const characterHeightPixels = 130;
const characterHeightBlocks = characterHeightPixels / blockSize;

// Calculate posY so feet rest exactly on top of grass layer
let posY = (groundLevelYBlocks - characterHeightBlocks) * blockSize;

console.log("Spawn Y position (px):", posY);

let velY = 0;
let gravity = 2.5;
let onGround = false;

let yaw = 0;
let pitch = 0;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let jump = false;

// === Pointer Lock Debugging ===
document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

scene.addEventListener('click', () => {
    scene.requestPointerLock();
});

// === Terrain Generation ===
function generateChunk(chunkX, chunkZ) {
    const chunkSize = 16;
    const chunkElement = document.createElement('div');
    chunkElement.className = 'chunk';
    chunkElement.style.transform = `translate3d(${chunkX * chunkSize * blockSize}px, 0px, ${chunkZ * chunkSize * blockSize}px)`;

    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            let height = 1; // Flat for now

            for (let y = 0; y < height + 80; y++) {
                const block = document.createElement('div');
                block.classList.add('block');

                if (y === 0) {
                    block.classList.add('grass');
                } else if (y <= 3) {
                    block.classList.add('dirt');
                } else {
                    block.classList.add('stone');
                }

                block.style.transform = `translate3d(${x * blockSize}px, ${-y * blockSize}px, ${z * blockSize}px)`;
                chunkElement.appendChild(block);
            }
        }
    }
    world.appendChild(chunkElement);
}

generateChunk(0, 0);

// === Movement & Physics ===
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveForward = true;
    if (e.code === 'KeyS') moveBackward = true;
    if (e.code === 'KeyA') moveLeft = true;
    if (e.code === 'KeyD') moveRight = true;
    if (e.code === 'Space') jump = true;
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveForward = false;
    if (e.code === 'KeyS') moveBackward = false;
    if (e.code === 'KeyA') moveLeft = false;
    if (e.code === 'KeyD') moveRight = false;
    if (e.code === 'Space') jump = false;
});

document.addEventListener('mousemove', (e) => {
    yaw += e.movementX * 0.1;
    pitch -= e.movementY * 0.1;
    pitch = Math.max(-89, Math.min(89, pitch));
});

// === Game Loop ===
function gameLoop() {
    let speed = 5;

    if (moveForward) {
        posX -= Math.sin(yaw * Math.PI / 180) * speed;
        posZ -= Math.cos(yaw * Math.PI / 180) * speed;
    }
    if (moveBackward) {
        posX += Math.sin(yaw * Math.PI / 180) * speed;
        posZ += Math.cos(yaw * Math.PI / 180) * speed;
    }
    if (moveLeft) {
        posX -= Math.cos(yaw * Math.PI / 180) * speed;
        posZ += Math.sin(yaw * Math.PI / 180) * speed;
    }
    if (moveRight) {
        posX += Math.cos(yaw * Math.PI / 180) * speed;
        posZ -= Math.sin(yaw * Math.PI / 180) * speed;
    }

    // Apply gravity
    if (!onGround) {
        velY -= gravity;
    } else {
        velY = 0;
    }

    if (jump && onGround) {
        velY = 30; // Jump strength
        onGround = false;
    }

    posY += velY;

    // Collision with ground
    const groundY = groundLevelYPixels - (characterHeightPixels);
    if (posY <= groundY) {
        posY = groundY;
        onGround = true;
    }

    // Update transforms
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraYaw.style.transform = `rotateY(${yaw}deg)`;
    cameraPitch.style.transform = `rotateX(${pitch}deg)`;
    cameraEye.style.transform = `translate3d(0px, ${-(posY - 120)}px, 0px)`;

    console.log("Player elevation (px):", posY);

    requestAnimationFrame(gameLoop);
}

gameLoop();
