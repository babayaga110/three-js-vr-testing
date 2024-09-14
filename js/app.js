import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import WebXRPolyfill from 'https://cdn.jsdelivr.net/npm/webxr-polyfill@2.0.3/+esm'

// Initialize the polyfill
const polyfill = new WebXRPolyfill();


// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add VR button
document.body.appendChild(VRButton.createButton(renderer));

renderer.xr.enabled = true;

// Add clock for animations
const clock = new THREE.Clock();

// Load textures
const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('textures/floor.png');
const skyTexture = textureLoader.load('textures/sky.jpg');

// Configure grass texture to repeat
grassTexture.wrapS = THREE.RepeatWrapping; 
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(200, 200);

// Create skysphere
const skysphereGeometry = new THREE.SphereGeometry(1000, 60, 40);
const skysphereMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
});
const skysphere = new THREE.Mesh(skysphereGeometry, skysphereMaterial);
scene.add(skysphere);

// Large grass floor (plane geometry)
const largePlaneGeometry = new THREE.PlaneGeometry(2000, 2000);
const grassMaterial = new THREE.MeshBasicMaterial({ map: grassTexture });
const grassFloor = new THREE.Mesh(largePlaneGeometry, grassMaterial);
grassFloor.rotation.x = -Math.PI / 2;
grassFloor.position.y = -1;
scene.add(grassFloor);

// Add lighting
const ambientLight = new THREE.AmbientLight(0x404040);
const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(5, 10, 5).normalize();
const pointLight = new THREE.PointLight(0xffffff, 1, 100);
pointLight.position.set(0, 5, 0);
scene.add(ambientLight);
scene.add(directionalLight);
scene.add(pointLight);

// Load machine model
const gltfLoader = new GLTFLoader();
gltfLoader.load('models/machine.glb', function(object) {
    // No need for `object.scene`, the object itself is the mesh
    let machine = object.scene;
    machine.traverse((child) => {
        if (child.isMesh) {
            child.geometry.computeBoundingBox();
            const bbox = child.geometry.boundingBox;
            const height = bbox.max.y - bbox.min.y;
            machine.position.y = -1 + height / 2; // Adjust position

            if (child.material) {
                child.material.needsUpdate = true;
            }
        }
    });

    machine.position.set(0, -1, 0); // Set position of the object
    machine.scale.set(7, 7, 7);     // Set scale of the object
    scene.add(machine);             // Add the object to the scene
}, function ( xhr ) {
    console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
}, function(error) {
    console.error('An error occurred while loading the OBJ model:', error);
});


// Load person model and animations
const fbxLoader = new FBXLoader();
let person, mixer, idleAction, walkAction, leftturnAction, rightturnAction ,backwardsAction;
let activeAction, previousAction;

fbxLoader.load('models/Remy.fbx', function(fbx) {
    person = fbx;
    person.scale.set(0.01, 0.01, 0.01);
    person.position.set(15, -1, 0);
    scene.add(person);
    console.log('Initial Rotation:', person.rotation);


    mixer = new THREE.AnimationMixer(person);

    // Load and assign animations
    fbxLoader.load('animations/Idle.fbx', (animation) => {
        idleAction = mixer.clipAction(animation.animations[0]);
        idleAction.play(); // Start with idle animation
        activeAction = idleAction;
    });

    fbxLoader.load('animations/Walking.fbx', (animation) => {
        walkAction = mixer.clipAction(animation.animations[0]);
        walkAction.setLoop(THREE.LoopRepeat);
    });
    fbxLoader.load('animations/LeftTurn.fbx', (animation) => {
        leftturnAction = mixer.clipAction(animation.animations[0]);
    }
    );
    fbxLoader.load('animations/RightTurn.fbx', (animation) => {
        rightturnAction = mixer.clipAction(animation.animations[0]);
    }
    );
    fbxLoader.load('animations/BackwardWalking.fbx', (animation) => {
        backwardsAction = mixer.clipAction(animation.animations[0]);
    }
    );
});

// Function to switch animations
function switchAnimation(toAction) {
    if (toAction !== activeAction) {
        previousAction = activeAction;
        activeAction = toAction;

        // Smooth animation transition
        previousAction.fadeOut(0.5);
        activeAction.reset().fadeIn(0.5).play();
    }
}

// Set camera position
camera.position.set(10, 15, -20);
camera.far = 2000; // or a higher value
camera.updateProjectionMatrix(); // Update the projection matrix after changing the far plane


// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enablePan = true;

controls.maxDistance = 600; // Set a maximum zoom out distance
// controls.minDistance = 10;  // Set a minimum zoom in distance


// Restrict rotation to prevent the camera from going beneath the floor
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2.2;

const floorY = -1;
const moveSpeed = 0.1;
const keyboard = {};
const rotationSpeed = 0.05;
let isMoving = false;

// Movement constraints
const movementArea = 30; // Size of the movement area around the machine



window.addEventListener('keydown', (event) => {
    keyboard[event.code] = true;
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        isMoving = true;
        if (walkAction) switchAnimation(walkAction);
    }
});

window.addEventListener('keyup', (event) => {
    keyboard[event.code] = false;
    if (!keyboard['ArrowUp'] && !keyboard['ArrowDown']) {
        isMoving = false;
        if (idleAction) switchAnimation(idleAction); // Switch back to idle
    }
});
window.addEventListener('keyleft', (event) => {
    keyboard[event.code] = true;
    if (event.code === 'ArrowLeft') {
        isMoving = true;
        if (leftturnAction) switchAnimation(leftturnAction);
    }
});
window.addEventListener('keyright', (event) => {
    keyboard[event.code] = true;
    if (event.code === 'ArrowRight') {
        isMoving = true;
        if (rightturnAction) switchAnimation(rightturnAction);
    }
});
function updateCamera() {
    if (person) {
        // Define an offset from the person’s position
        const offset = new THREE.Vector3(0, 5, -10); // Position the camera behind and above
        // Create a matrix to apply the person's rotation
        const rotationMatrix = new THREE.Matrix4().makeRotationY(person.rotation.y);
        // Apply rotation to the offset vector
        const rotatedOffset = offset.applyMatrix4(rotationMatrix);

        // Set the camera’s position based on the rotated offset
        const cameraPosition = person.position.clone().add(rotatedOffset);
        camera.position.copy(cameraPosition);

        // Ensure the camera always looks at the person
        camera.lookAt(person.position);
    }
}


function updateLighting() {
    if (person) {
        // Position the directional light to always be in front and above the person
        directionalLight.position.copy(person.position).add(new THREE.Vector3(10, 10, 10));

        // Position the point light close to the person
        pointLight.position.copy(person.position).add(new THREE.Vector3(0, 5, 0));
    }
}




// Adjust rotation speed and movement spe
function handleMovement() {
    if (person) {

        // Adjust direction vectors for movement
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(person.quaternion); // Forward direction
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(person.quaternion); // Right direction

        let newPosition = person.position.clone();

        // Adjust movement keys
        if (keyboard['ArrowUp']) {
            newPosition.add(forward.multiplyScalar(moveSpeed));
            if (walkAction) switchAnimation(walkAction);
        }
        if (keyboard['ArrowDown']) {
            newPosition.add(forward.multiplyScalar(-moveSpeed));
            if (backwardsAction) switchAnimation(backwardsAction);
        }
        if (keyboard['ArrowLeft']) {
            // Rotate the person to the left
            person.rotation.y += rotationSpeed;
            if (leftturnAction) switchAnimation(leftturnAction);
        }
        if (keyboard['ArrowRight']) {
            // Rotate the person to the right
            person.rotation.y -= rotationSpeed;
            if (rightturnAction) switchAnimation(rightturnAction);
        }

        // Ensure the model's bounding box is used to determine correct positioning
        person.traverse((child) => {
            if (child.isMesh) {
                child.geometry.computeBoundingBox();
                const bbox = child.geometry.boundingBox;
                const height = bbox.max.y - bbox.min.y;
                person.position.y = Math.max(floorY + height / 2, person.position.y);
            }
        });

        // Check if new position is within the allowed area around the machine
        const distanceToMachine = newPosition.distanceTo(new THREE.Vector3(0, 0, 0));
        if (distanceToMachine < movementArea) {
            person.position.copy(newPosition);
        }

        // Constrain movement to stay on the floor
        if (person.position.y < floorY) {
            person.position.y = floorY;
        }

    }
}



// Animation loop
function animate() {
    const delta = clock.getDelta();
    controls.update();

    if (mixer) mixer.update(delta);
    handleMovement(); // Handle keyboard movement
    if(isMoving){
        updateCamera(); // Update camera position
        updateLighting(); // Update lighting position
    }
    renderer.render(scene, camera);
}
