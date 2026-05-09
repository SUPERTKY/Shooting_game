import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

const status = document.querySelector('#status');
const canvasContainer = document.querySelector('#game-canvas');
const wallPath = './assets/wall.glb';
const ringPath = './image/ring.png';
const wallRotationY = Math.PI / 2;
const ringHeight = 1.8;
const ringPositionOffsetRatio = new THREE.Vector2(0.16, -0.12);
const ringColliderScale = 0.6;
const clock = new THREE.Clock();

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasContainer.appendChild(renderer.domElement);

  return renderer;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 2.1, 7);
  camera.lookAt(0, 1, 0);

  return camera;
}

function addLights(scene) {
  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x38445c, 1.8);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x80bfff, 25, 12);
  fillLight.position.set(-3, 2.5, 3);
  scene.add(fillLight);

  return { ambientLight, keyLight, fillLight };
}

function createGround(scene, world) {
  const groundGeometry = new THREE.PlaneGeometry(16, 16);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x20242f,
    roughness: 0.85,
    metalness: 0.05,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0),
  );
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(8, 0.05, 8),
    groundBody,
  );

  return { ground, groundBody, groundCollider };
}

function frameObjectInView(object, camera) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  camera.position.set(center.x, center.y + maxSize * 0.35, center.z + distance * 1.8);
  camera.lookAt(center.x, center.y + size.y * 0.15, center.z);
  camera.updateProjectionMatrix();
}

async function loadWall(scene, world) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(wallPath);
  const wall = gltf.scene;
  wall.name = 'collision-wall';
  wall.position.set(0, 0, 0);
  wall.rotation.y = wallRotationY;

  wall.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(wall);
  wall.updateWorldMatrix(true, true);

  const wallBox = new THREE.Box3().setFromObject(wall);
  const wallSize = wallBox.getSize(new THREE.Vector3());
  const wallCenter = wallBox.getCenter(new THREE.Vector3());

  const wallBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(wallCenter.x, wallCenter.y, wallCenter.z),
  );
  const wallCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(wallSize.x / 2, wallSize.y / 2, wallSize.z / 2),
    wallBody,
  );
  wallCollider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return { wall, wallBody, wallCollider, wallBox };
}

async function loadRing(scene, world, wallBox) {
  const texture = await new THREE.TextureLoader().loadAsync(ringPath);
  texture.colorSpace = THREE.SRGBColorSpace;

  const imageAspect = texture.image.width / texture.image.height;
  const ringWidth = ringHeight * imageAspect;
  const ringGeometry = new THREE.PlaneGeometry(ringWidth, ringHeight);
  const ringMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.name = 'target-ring';

  const wallSize = wallBox.getSize(new THREE.Vector3());
  const wallCenter = wallBox.getCenter(new THREE.Vector3());
  ring.position.set(
    wallCenter.x + wallSize.x * ringPositionOffsetRatio.x,
    wallCenter.y + wallSize.y * ringPositionOffsetRatio.y,
    wallBox.max.z + 0.05,
  );
  scene.add(ring);

  const colliderSide = Math.min(ringWidth, ringHeight) * ringColliderScale;
  const ringBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(ring.position.x, ring.position.y, ring.position.z),
  );
  const ringCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(colliderSide / 2, colliderSide / 2, 0.05),
    ringBody,
  );
  ringCollider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return {
    ring,
    ringBody,
    ringCollider,
    colliderSide,
  };
}

async function init() {
  await RAPIER.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111722);

  const gravity = new RAPIER.Vector3(0, -9.81, 0);
  const world = new RAPIER.World(gravity);
  const renderer = createRenderer();
  const camera = createCamera();
  const lights = addLights(scene);
  const ground = createGround(scene, world);

  status.textContent = '壁モデル、リング画像、当たり判定を読み込み中...';
  const wall = await loadWall(scene, world);
  frameObjectInView(wall.wall, camera);
  const ring = await loadRing(scene, world, wall.wallBox);
  status.textContent = 'image/ring.png を画面中央から少し右下へ配置し、0.6倍サイズの正方形当たり判定を追加しました。';

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    world.timestep = delta;
    world.step();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();

  // 今後のゲーム初期化で使えるように、最小構成を公開しておく。
  window.gameRuntime = {
    THREE,
    RAPIER,
    scene,
    world,
    renderer,
    camera,
    lights,
    ground,
    wall,
    ring,
  };
}

init().catch((error) => {
  console.error(error);
  status.textContent = '壁モデル、リング画像、またはライブラリの読み込みに失敗しました。';
});
