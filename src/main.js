import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

const status = document.querySelector('#status');
const canvasContainer = document.querySelector('#game-canvas');
const ringUi = document.querySelector('#target-ring-ui');
const ringImage = document.querySelector('#target-ring-image');
const ringTraceArea = document.querySelector('#target-ring-trace-area');
const shootButton = document.querySelector('#shoot-button');
const wallPath = './assets/wall.glb';
const gunPath = './assets/gun.glb';
const bulletPath = './assets/bullet.glb';
const tablePath = './assets/Table.glb';
const wallRotationY = Math.PI / 2;
const ringTraceAreaScale = 0.8;
const gunViewPosition = new THREE.Vector3(0, -0.12, -0.55);
const tableViewPosition = new THREE.Vector3(0, -1.15, -2.4);
const tableViewRotation = new THREE.Euler(0, Math.PI, 0);
const tableViewMaxSize = 1.9;
const gunViewRotation = new THREE.Euler(0, -Math.PI / 2, 0);
const gunAimLimits = {
  maxYaw: THREE.MathUtils.degToRad(28),
  maxPitch: THREE.MathUtils.degToRad(18),
};
const gunViewMaxSize = 0.65;
const gunForwardPointOffset = new THREE.Vector3(-0.46, 0.03, 0);
const gunForwardPointRadius = 0.04;
const bulletSpeed = 16;
const bulletLifetime = 8;
const maxActiveBullets = 30;
const bulletSpawnOffset = 0.08;
const bulletScale = 0.025;
const bulletColliderMinRadius = 0.035 * bulletScale;
const gunForwardDirection = new THREE.Vector3(-1, 0, 0);
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

  camera.position.set(center.x, center.y + maxSize * 0.35, center.z + distance * 1.25);
  camera.lookAt(center.x, center.y + size.y * 0.15, center.z);
  camera.updateProjectionMatrix();
}

function createGunForwardPoint(gunScale) {
  const markerScale = gunScale > 0 ? gunScale : 1;
  const pointGeometry = new THREE.SphereGeometry(gunForwardPointRadius / markerScale, 24, 16);
  const pointMaterial = new THREE.MeshBasicMaterial({
    color: 0xff315f,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
  });
  const forwardPoint = new THREE.Mesh(pointGeometry, pointMaterial);
  forwardPoint.name = 'gun-forward-point';
  forwardPoint.position.copy(gunForwardPointOffset).divideScalar(markerScale);
  forwardPoint.renderOrder = 10;

  return forwardPoint;
}

async function loadTable(camera) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(tablePath);
  const tableModel = gltf.scene;
  const table = new THREE.Group();
  table.name = 'camera-front-table';

  tableModel.updateWorldMatrix(true, true);
  const tableBox = new THREE.Box3().setFromObject(tableModel);
  const tableCenter = tableBox.getCenter(new THREE.Vector3());
  const tableSize = tableBox.getSize(new THREE.Vector3());
  const tableMaxSize = Math.max(tableSize.x, tableSize.y, tableSize.z);
  const tableScale = tableMaxSize > 0 ? tableViewMaxSize / tableMaxSize : 1;

  tableModel.position.sub(tableCenter);
  table.add(tableModel);
  table.scale.setScalar(tableScale);
  table.position.copy(tableViewPosition);
  table.rotation.copy(tableViewRotation);

  table.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  camera.add(table);

  return { table, tableModel };
}

async function loadGun(camera) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(gunPath);
  const gunModel = gltf.scene;
  const gun = new THREE.Group();
  gun.name = 'camera-gun';

  gunModel.updateWorldMatrix(true, true);
  const gunBox = new THREE.Box3().setFromObject(gunModel);
  const gunCenter = gunBox.getCenter(new THREE.Vector3());
  const gunSize = gunBox.getSize(new THREE.Vector3());
  const gunMaxSize = Math.max(gunSize.x, gunSize.y, gunSize.z);
  const gunScale = gunMaxSize > 0 ? gunViewMaxSize / gunMaxSize : 1;

  gunModel.position.sub(gunCenter);
  gun.add(gunModel);
  gun.scale.setScalar(gunScale);
  gun.position.copy(gunViewPosition);
  gun.rotation.copy(gunViewRotation);

  gun.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const forwardPoint = createGunForwardPoint(gunScale);
  gun.add(forwardPoint);

  camera.add(gun);

  return { gun, gunModel, forwardPoint };
}


async function loadBulletTemplate() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(bulletPath);
  const bulletModel = gltf.scene;
  bulletModel.name = 'bullet-template';

  bulletModel.updateWorldMatrix(true, true);
  const bulletBox = new THREE.Box3().setFromObject(bulletModel);
  const bulletCenter = bulletBox.getCenter(new THREE.Vector3());
  const bulletSize = bulletBox.getSize(new THREE.Vector3());

  bulletModel.position.sub(bulletCenter);
  bulletModel.scale.setScalar(bulletScale);
  bulletModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const fallbackHalfExtent = bulletColliderMinRadius;
  const halfExtents = new THREE.Vector3(
    Math.max((bulletSize.x * bulletScale) / 2, fallbackHalfExtent),
    Math.max((bulletSize.y * bulletScale) / 2, fallbackHalfExtent),
    Math.max((bulletSize.z * bulletScale) / 2, fallbackHalfExtent),
  );

  return { model: bulletModel, halfExtents };
}

function getGunMuzzleWorldTransform(gun) {
  const muzzlePosition = new THREE.Vector3();
  const gunQuaternion = new THREE.Quaternion();
  const muzzleDirection = gunForwardDirection.clone();

  gun.forwardPoint.getWorldPosition(muzzlePosition);
  gun.gun.getWorldQuaternion(gunQuaternion);
  muzzleDirection.applyQuaternion(gunQuaternion).normalize();
  muzzlePosition.addScaledVector(muzzleDirection, bulletSpawnOffset);

  return { muzzlePosition, muzzleDirection };
}

function createBullet(scene, world, bulletTemplate, gun) {
  const { muzzlePosition, muzzleDirection } = getGunMuzzleWorldTransform(gun);
  const bullet = bulletTemplate.model.clone(true);
  const bulletRotation = new THREE.Quaternion().setFromUnitVectors(
    gunForwardDirection,
    muzzleDirection,
  );
  bullet.name = 'physics-bullet';
  bullet.position.copy(muzzlePosition);
  bullet.quaternion.copy(bulletRotation);
  scene.add(bullet);

  const bulletBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(muzzlePosition.x, muzzlePosition.y, muzzlePosition.z)
      .setRotation({
        x: bulletRotation.x,
        y: bulletRotation.y,
        z: bulletRotation.z,
        w: bulletRotation.w,
      })
      .setCcdEnabled(true)
      .setLinearDamping(0.02)
      .setAngularDamping(0.2),
  );
  bulletBody.setLinvel(
    {
      x: muzzleDirection.x * bulletSpeed,
      y: muzzleDirection.y * bulletSpeed,
      z: muzzleDirection.z * bulletSpeed,
    },
    true,
  );

  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      bulletTemplate.halfExtents.x,
      bulletTemplate.halfExtents.y,
      bulletTemplate.halfExtents.z,
    ).setRestitution(0.1),
    bulletBody,
  );
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return {
    mesh: bullet,
    body: bulletBody,
    collider,
    age: 0,
  };
}

function syncBulletMeshes(bullets) {
  bullets.forEach((bullet) => {
    const position = bullet.body.translation();
    const rotation = bullet.body.rotation();

    bullet.mesh.position.set(position.x, position.y, position.z);
    bullet.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  });
}

function removeBullet(scene, world, bullet) {
  scene.remove(bullet.mesh);
  world.removeRigidBody(bullet.body);
}

function pruneBullets(scene, world, bullets, delta) {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index];
    bullet.age += delta;

    if (bullet.age > bulletLifetime || bullet.mesh.position.y < -4) {
      removeBullet(scene, world, bullet);
      bullets.splice(index, 1);
    }
  }

  while (bullets.length > maxActiveBullets) {
    const bullet = bullets.shift();
    removeBullet(scene, world, bullet);
  }
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

function syncRingTraceArea() {
  const imageRect = ringImage.getBoundingClientRect();
  const traceSide = Math.min(imageRect.width, imageRect.height) * ringTraceAreaScale;

  ringTraceArea.style.width = `${traceSide}px`;
  ringTraceArea.style.height = `${traceSide}px`;
}

function setupRingUi() {
  const syncWhenReady = () => requestAnimationFrame(syncRingTraceArea);

  if (ringImage.complete) {
    syncWhenReady();
  } else {
    ringImage.addEventListener('load', syncWhenReady, { once: true });
  }

  window.addEventListener('resize', syncWhenReady);

  const aimDirection = new THREE.Vector2(0, 0);
  const tracedPoints = [];
  const updateTracePoint = (event) => {
    const areaRect = ringTraceArea.getBoundingClientRect();
    const centerX = areaRect.width / 2;
    const centerY = areaRect.height / 2;
    const localX = event.clientX - areaRect.left;
    const localY = event.clientY - areaRect.top;
    const radius = Math.max(Math.min(areaRect.width, areaRect.height) / 2, 1);
    const nextAim = new THREE.Vector2((localX - centerX) / radius, (localY - centerY) / radius);

    if (nextAim.length() > 1) {
      nextAim.normalize();
    }

    aimDirection.copy(nextAim);
    tracedPoints.push({
      x: localX,
      y: localY,
      aimX: aimDirection.x,
      aimY: aimDirection.y,
    });
  };
  const finishAim = (event) => {
    if (ringTraceArea.hasPointerCapture(event.pointerId)) {
      ringTraceArea.releasePointerCapture(event.pointerId);
    }
  };

  ringTraceArea.addEventListener('pointerdown', (event) => {
    tracedPoints.length = 0;
    ringTraceArea.setPointerCapture(event.pointerId);
    updateTracePoint(event);
  });

  ringTraceArea.addEventListener('pointermove', (event) => {
    if (ringTraceArea.hasPointerCapture(event.pointerId)) {
      updateTracePoint(event);
    }
  });

  ringTraceArea.addEventListener('pointerup', finishAim);
  ringTraceArea.addEventListener('pointercancel', finishAim);

  return {
    element: ringUi,
    image: ringImage,
    traceArea: ringTraceArea,
    aimDirection,
    aimLimits: gunAimLimits,
    tracedPoints,
    syncTraceArea: syncWhenReady,
  };
}

function applyGunAim(gun, aimDirection) {
  const yawOffset = aimDirection.x * gunAimLimits.maxYaw;
  const pitchOffset = -aimDirection.y * gunAimLimits.maxPitch;

  gun.gun.rotation.set(
    gunViewRotation.x + pitchOffset,
    gunViewRotation.y + yawOffset,
    gunViewRotation.z,
  );
}

async function init() {
  await RAPIER.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111722);

  const gravity = new RAPIER.Vector3(0, -9.81, 0);
  const world = new RAPIER.World(gravity);
  const renderer = createRenderer();
  const camera = createCamera();
  scene.add(camera);
  const lights = addLights(scene);
  const ground = createGround(scene, world);

  status.textContent = '壁モデル、テーブルモデル、銃モデル、弾モデル、UIリングを読み込み中...';
  const ring = setupRingUi();
  const wall = await loadWall(scene, world);
  frameObjectInView(wall.wall, camera);
  const table = await loadTable(camera);
  const gun = await loadGun(camera);
  const bulletTemplate = await loadBulletTemplate();
  const bullets = [];
  status.textContent = 'リングをドラッグして狙い、ショットボタンで銃口から弾を発射します。';

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', onResize);

  shootButton.addEventListener('click', () => {
    applyGunAim(gun, ring.aimDirection);
    bullets.push(createBullet(scene, world, bulletTemplate, gun));
  });

  function animate() {
    const delta = Math.min(clock.getDelta(), 0.05);
    world.timestep = delta;
    world.step();
    applyGunAim(gun, ring.aimDirection);
    syncBulletMeshes(bullets);
    pruneBullets(scene, world, bullets, delta);
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
    table,
    gun,
    bulletTemplate,
    bullets,
    ring,
    aimLimits: gunAimLimits,
  };
}

init().catch((error) => {
  console.error(error);
  status.textContent = '壁モデル、テーブルモデル、銃モデル、弾モデル、UIリング、またはライブラリの読み込みに失敗しました。';
});
