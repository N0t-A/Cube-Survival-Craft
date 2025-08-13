console.log("Script running");

// === Game setup ===
const playerModel = document.getElementById("player-model");
const cameraYaw = document.getElementById("camera-yaw");
const cameraPitch = document.getElementById("camera-pitch");
const cameraEye = document.getElementById("camera-eye");
const scene = document.getElementById("scene");
const world = document.getElementById("world");

// Block size in pixels
const blockSize = 70;

// Player settings
let posX = 0;
let posY = -blockSize * 3; // Start 3 blocks above ground level
let posZ = 0;
let velY = 0;
let gravity = 2;
let jumpStrength = 70;
let onGround = false;

// Camera settings
let yaw = 0;
let pitch = 0;
const eyeHeight = 120;

// Key tracking
const keys = {};

// === Pointer Lock ===
scene.addEventListener("click", () => {
    scene.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

// === Camera control ===
document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === scene) {
        yaw += e.movementX * 0.1;
        pitch -= e.movementY * 0.1;
        pitch = Math.max(-90, Math.min(90, pitch));

        cameraYaw.style.transform = `rotateY(${yaw}deg)`;
        cameraPitch.style.transform = `rotateX(${pitch}deg)`;

        console.log(`Camera Yaw: ${yaw.toFixed(2)}°, Pitch: ${pitch.toFixed(2)}°`);
    }
});

// === Movement control ===
document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
});
document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

// === World Generation ===
function generateChunk(chunkX, chunkZ, size = 16) {
    for (let x = 0; x < size; x++) {
        for (let z = 0; z < size; z++) {
            let worldX = chunkX * size + x;
            let worldZ = chunkZ * size + z;

            // Ground level
            let grassY = 0;

            // Grass block
            createBlock(worldX, grassY, worldZ, "grass");

            // Dirt layer (2-3 blocks deep)
            let dirtDepth = Math.floor(Math.random() * 2) + 2;
            for (let d = 1; d <= dirtDepth; d++) {
                createBlock(worldX, grassY + d, worldZ, "dirt");
            }

            // Stone layer down to 80 blocks
            for (let s = dirtDepth + 1; s <= 80; s++) {
                createBlock(worldX, grassY + s, worldZ, "stone");
            }
        }
    }
}

function createBlock(x, y, z, type) {
    const block = document.createElement("div");
    block.className = `block ${type}`;
    block.style.transform = `translate3d(${x * blockSize}px, ${-y * blockSize}px, ${z * blockSize}px)`;
    world.appendChild(block);
}

// === Initial chunk generation ===
generateChunk(0, 0);

// === Game Loop ===
function gameLoop() {
    // Gravity
    velY += gravity;
    posY += velY;

    // Collision detection (very simple: stop at ground level)
    if (posY > 0) {
        posY = 0;
        velY = 0;
        onGround = true;
    } else {
        onGround = false;
    }

    // Jump
    if (keys["Space"] && onGround) {
        velY = -jumpStrength;
        onGround = false;
    }

    // Movement (basic forward/backward/strafe)
    let speed = 5;
    if (keys["KeyW"]) {
        posX -= Math.sin((yaw * Math.PI) / 180) * speed;
        posZ -= Math.cos((yaw * Math.PI) / 180) * speed;
    }
    if (keys["KeyS"]) {
        posX += Math.sin((yaw * Math.PI) / 180) * speed;
        posZ += Math.cos((yaw * Math.PI) / 180) * speed;
    }
    if (keys["KeyA"]) {
        posX -= Math.cos((yaw * Math.PI) / 180) * speed;
        posZ += Math.sin((yaw * Math.PI) / 180) * speed;
    }
    if (keys["KeyD"]) {
        posX += Math.cos((yaw * Math.PI) / 180) * speed;
        posZ -= Math.sin((yaw * Math.PI) / 180) * speed;
    }

    // Update camera and player model
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraEye.style.transform = `translate3d(0px, ${-(posY + eyeHeight)}px, 0px)`;

    // Log elevation
    console.log(`Character elevation: ${posY.toFixed(2)}px`);

    requestAnimationFrame(gameLoop);
}

gameLoop();
