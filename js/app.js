import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import WebXRPolyfill from 'https://cdn.jsdelivr.net/npm/webxr-polyfill@2.0.3/+esm';

// Initialize the polyfill
const polyfill = new WebXRPolyfill();

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

// Add VR button
document.body.appendChild(VRButton.createButton(renderer));

// Create a div to show the message
const instructionDiv = document.createElement('div');
instructionDiv.style.position = 'absolute';
instructionDiv.style.top = '10px';
instructionDiv.style.left = '10px';
instructionDiv.style.color = 'white';
instructionDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
instructionDiv.style.padding = '10px';
instructionDiv.style.borderRadius = '5px';
instructionDiv.innerHTML = "Measurement tool is off";
document.body.appendChild(instructionDiv);

// Renderer setup
renderer.xr.enabled = true;

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
directionalLight.position.set(5, 10, 5);
scene.add(ambientLight);
scene.add(directionalLight);

// Load machine model
const gltfLoader = new GLTFLoader();
let machine;
gltfLoader.load('models/machine.glb', function (object) {
    machine = object.scene;
    machine.traverse((child) => {
        if (child.isMesh) {
            child.geometry.computeBoundingBox();
            const bbox = child.geometry.boundingBox;
            const height = bbox.max.y - bbox.min.y;
            machine.position.y = -1 + height / 2; // Adjust position
        }
    });

    machine.scale.set(1, 1, 1); // Adjust scaling based on your model's real-world size.
    machine.position.set(0, -1, 0);
    scene.add(machine);
}, undefined, function (error) {
    console.error('An error occurred while loading the GLB model:', error);
});

// Set camera position
camera.position.set(10, 15, -20);
camera.far = 5000;
camera.updateProjectionMatrix(); 

// Add OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;
controls.enablePan = true;
controls.maxDistance = 600;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI / 2.2;

// Raycaster for interaction detection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let selectedPoint = null;
let measurementEnabled = false; // Track if measurement tool is active

// Create a line to display measurements
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
let measurementLine = null;

// Create markers for selected points
const markerGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
let markers = [];

// VR controller setup
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);
scene.add(controller1);
scene.add(controller2);

// Event listener for selecting points with VR controllers
renderer.xr.addEventListener('selectstart', onVRSelectStart);

function onVRSelectStart(event) {
    const controller = event.target;
    const intersection = getControllerIntersection(controller);

    if (measurementEnabled && intersection) {
        const intersectedPoint = intersection.point;
        if (selectedPoint) {
            const distance = selectedPoint.distanceTo(intersectedPoint);
            instructionDiv.innerHTML = `Distance: ${distance.toFixed(2)} meters. Click to measure again.`;
            if (measurementLine) {
                scene.remove(measurementLine);
            }
            if (markers.length > 0) {
                markers.forEach(marker => scene.remove(marker));
                markers = [];
            }
            drawLine(selectedPoint, intersectedPoint);
            selectedPoint = null;
        } else {
            selectedPoint = intersectedPoint;
            addMarker(selectedPoint);
            instructionDiv.innerHTML = 'Click on a second point to measure distance';
        }
    }
}

// Add toggle button
const toggleButton = document.createElement('button');
toggleButton.innerHTML = 'Toggle Measurement Tool';
toggleButton.style.position = 'absolute';
toggleButton.style.top = '50px';
toggleButton.style.left = '10px';
toggleButton.style.padding = '10px';
toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
toggleButton.style.color = 'white';
toggleButton.style.border = 'none';
toggleButton.style.borderRadius = '5px';
toggleButton.style.zIndex = 1; // Ensure button is on top
document.body.appendChild(toggleButton);

toggleButton.addEventListener('click', () => {
    measurementEnabled = !measurementEnabled;
    instructionDiv.innerHTML = measurementEnabled ? 'Click on two points to measure distance' : 'Measurement tool is off';
    if (!measurementEnabled) {
        resetMeasurement(); // Reset if tool is turned off
    }
});

// Add reset button
const resetButton = document.createElement('button');
resetButton.innerHTML = 'Reset Measurement';
resetButton.style.position = 'absolute';
resetButton.style.top = '90px';
resetButton.style.left = '10px';
resetButton.style.padding = '10px';
resetButton.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
resetButton.style.color = 'white';
resetButton.style.border = 'none';
resetButton.style.borderRadius = '5px';
resetButton.style.zIndex = 1; // Ensure button is on top
document.body.appendChild(resetButton);

resetButton.addEventListener('click', () => {
    resetMeasurement();
});

function drawLine(start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    measurementLine = new THREE.Line(geometry, lineMaterial);
    scene.add(measurementLine);
}

function addMarker(position) {
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(position);
    marker.scale.set(0.05, 0.05, 0.05);
    scene.add(marker);
    markers.push(marker);
}

function resetMeasurement() {
    selectedPoint = null;
    if (measurementLine) {
        scene.remove(measurementLine);
        measurementLine = null;
    }
    if (markers.length > 0) {
        markers.forEach(marker => scene.remove(marker));
        markers = [];
    }
    instructionDiv.innerHTML = measurementEnabled ? 'Click on two points to measure distance' : 'Measurement tool is off';
}

// Get the intersection point of the controller ray with the machine
function getControllerIntersection(controller) {
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    return raycaster.intersectObject(machine, true)[0];
}

// Handle mouse clicks for measurement
function onMouseClick(event) {
    event.preventDefault();
    
    if (!measurementEnabled) return;
    
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) / rect.width * 2 - 1;
    mouse.y = - (event.clientY - rect.top) / rect.height * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(machine, true);

    if (intersects.length > 0) {
        const intersectedPoint = intersects[0].point;
        if (selectedPoint) {
            const distance = selectedPoint.distanceTo(intersectedPoint);
            instructionDiv.innerHTML = `Distance: ${distance.toFixed(2)} meters. Click to measure again.`;
            if (measurementLine) {
                scene.remove(measurementLine);
            }
            if (markers.length > 0) {
                markers.forEach(marker => scene.remove(marker));
                markers = [];
            }
            drawLine(selectedPoint, intersectedPoint);
            selectedPoint = null;
        } else {
            selectedPoint = intersectedPoint;
            addMarker(selectedPoint);
            instructionDiv.innerHTML = 'Click on a second point to measure distance';
        }
    }
}

function handleVRControls(controller) {
    const controllerState = controller.gamepad;
    if (controllerState) {
        const zoomSpeed = 0.1; // Speed at which the camera zooms in/out
        const rotationSpeed = 0.02; // Speed at which the camera rotates

        // Handle zooming
        if (controllerState.axes[1]) { // Assuming axis[1] controls zoom
            camera.position.z += controllerState.axes[1] * zoomSpeed;
        }

        // Handle rotation
        if (controllerState.axes[0]) { // Assuming axis[0] controls horizontal rotation
            camera.rotation.y += controllerState.axes[0] * rotationSpeed;
        }
        if (controllerState.axes[3]) { // Assuming axis[3] controls vertical rotation
            camera.rotation.x += controllerState.axes[3] * rotationSpeed;
        }
    }
}

// In your animation loop or VR controller update function
function animate() {
    controls.update();
    handleVRControls(renderer.xr.getController(0)); // Handle controls for the first controller
    handleVRControls(renderer.xr.getController(1)); // Handle controls for the second controller
    renderer.render(scene, camera);
}


document.addEventListener('click', onMouseClick);

