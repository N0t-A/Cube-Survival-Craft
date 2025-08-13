console.log("Script running");

const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

scene.tabIndex = 0; // Ensure scene is focusable for pointer lock
scene.style.outline = 'none';

// ====== Pointer Lock Setup ======
scene.addEventListener('click', () => {
    if (document.pointerLockElement !== scene) {
        scene.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

document.addEventListener('pointerlockerror', () => {
    console.error("Pointer lock request failed.");
});

// ====== Player Variables ======
let posX = 0;
let posY = -40 - (70 * 3); // Start 3 blocks above ground level
let posZ = 0;
let velY = 0;
const gravity = 0.98;
const jumpStrength = -17; // Negative because -Y is up
const moveSpeed = 5;
let onGround = false;

// ====== Input Tracking ======
let keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ====== Mouse Look ======
let yaw = 0;
let pitch = 0;
document.addEventListener('mousemove', e => {
    if (document.pointerLockElement === scene) {
        yaw += e.movementX * 0.1;
        pitch -= e.movementY * 0.1;
        pitch = Math.max(-90, Math.min(90, pitch));
        cameraYaw.style.transform = `rotateY(${yaw}deg)`;
        cameraPitch.style.transform = `rotateX(${pitch}deg)`;
    }
});

// ====== World Generation ======
function generateChunk() {
    const chunkSize = 16;
    const blockSize = 70;
    for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
            for (let y = 0; y < 80; y++) {
                let block = document.createElement('div');
                block.classList.add('block');

                if (y === 0) {
                    block.classList.add('grass');
                } else if (y < 3) {
                    block.classList.add('dirt');
                } else {
                    block.classList.add('stone');
                }

                block.style.transform = `translate3d(${x * blockSize}px, ${y * blockSize}px, ${z * blockSize}px)`;
                world.appendChild(block);
            }
        }
    }
}
generateChunk();

// ====== Game Loop ======
function gameLoop() {
    // Gravity
    if (!onGround) {
        velY += gravity;
    }

    // Jump
    if (keys["Space"] && onGround) {
        velY = jumpStrength;
        onGround = false;
    }

    posY += velY;

    // Ground collision check
    const groundLevel = -40; // Ground Y level
    if (posY >= groundLevel) {
        posY = groundLevel;
        velY = 0;
        onGround = true;
    }

    // Movement (basic)
    let forward = 0;
    let right = 0;
    if (keys["KeyW"]) forward += 1;
    if (keys["KeyS"]) forward -= 1;
    if (keys["KeyD"]) right += 1;
    if (keys["KeyA"]) right -= 1;

    const radYaw = yaw * (Math.PI / 180);
    posX += (forward * Math.sin(radYaw) + right * Math.cos(radYaw)) * moveSpeed;
    posZ += (forward * Math.cos(radYaw) - right * Math.sin(radYaw)) * moveSpeed;

    // Update transforms
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraEye.style.transform = `translate3d(0px, ${posY - 120}px, 0px)`;

    console.log(`Character elevation: ${posY}`);

    requestAnimationFrame(gameLoop);
}
gameLoop();
