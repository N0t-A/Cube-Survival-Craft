console.log("Script running...");

// === Game setup ===
const playerModel = document.getElementById('player-model');
const cameraYaw = document.getElementById('camera-yaw');
const cameraPitch = document.getElementById('camera-pitch');
const cameraEye = document.getElementById('camera-eye');
const scene = document.getElementById('scene');
const world = document.getElementById('world');

// === Player variables ===
let posX = 0;
let posY = -40; // Ground level (inverted Y-axis: negative is up)
let posZ = 0;
let velY = 0;
const gravity = 2; // Pulls player downward (positive direction in inverted system)
const eyeHeight = 120; // Eye position above feet in px
const blockSize = 70; // Size of one block in px
let grounded = false;

// === Camera rotation variables ===
let yaw = 0;
let pitch = 0;

// === Pointer lock handling ===
document.body.addEventListener('click', () => {
    scene.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === scene) {
        console.log("Pointer lock ON");
    } else {
        console.log("Pointer lock OFF");
    }
});

// === Mouse movement for view rotation ===
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === scene) {
        yaw += e.movementX * 0.1;
        pitch -= e.movementY * 0.1;
        pitch = Math.max(-89, Math.min(89, pitch));
        cameraYaw.style.transform = `rotateY(${yaw}deg)`;
        cameraPitch.style.transform = `rotateX(${pitch}deg)`;
        console.log(`Camera Yaw: ${yaw.toFixed(2)}°, Pitch: ${pitch.toFixed(2)}°`);
    }
});

// === Simple keyboard input ===
const keys = {};
document.addEventListener('keydown', (e) => keys[e.code] = true);
document.addEventListener('keyup', (e) => keys[e.code] = false);

// === Game loop ===
function gameLoop() {
    // Apply gravity
    if (!grounded) {
        velY += gravity;
    }

    // Jump
    if (keys['Space'] && grounded) {
        velY = -30; // Jump strength (negative to go upward in inverted Y-axis)
        grounded = false;
    }

    // Move player vertically
    posY += velY;

    // Collision detection with ground
    const groundY = -40; // Ground level
    if (posY > groundY) { // Player fell below ground in inverted Y-axis
        posY = groundY;
        velY = 0;
        grounded = true;
    }

    // Apply transforms
    playerModel.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
    cameraEye.style.transform = `translate3d(0px, ${posY + eyeHeight}px, 0px)`;

    // Debugging logs
    const playerBlocks = -(posY / blockSize); // Negative because inverted Y
    const cameraBlocks = -((posY + eyeHeight) / blockSize);
    console.log(`Player Elevation: ${posY}px (${playerBlocks.toFixed(2)} blocks), Camera Elevation: ${posY + eyeHeight}px (${cameraBlocks.toFixed(2)} blocks)`);

    requestAnimationFrame(gameLoop);
}

// Start loop
gameLoop();
