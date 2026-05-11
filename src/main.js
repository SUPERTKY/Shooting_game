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
const shelfPath = './assets/shelf.glb';
const tentPath = './assets/Tent.glb';
const prizePath = './Prize/Prize_1.glb';
const wallRotationY = Math.PI / 2;
const ringTraceAreaScale = 0.8;
const gunViewPosition = new THREE.Vector3(0, -0.12, -0.55);
const tableViewPosition = new THREE.Vector3(0, -0.4, -0.5);
const tableViewRotation = new THREE.Euler(0, 0, 0);
const tableViewQuaternion = new THREE.Quaternion().setFromEuler(tableViewRotation);
const tableViewMaxSize = 1;
const tentPosition = new THREE.Vector3(0, 0, -2);
const tentRotation = new THREE.Euler(0, 0, 0);
const tentViewMaxSize = 2;
const prizePosition = new THREE.Vector3(-0.5, 0.5, -1.7);
const prizeRotation = new THREE.Euler(0, 0, 0);
const prizeViewMaxSize = 0.2;
const prizeLinearDamping = 0.35;
const prizeAngularDamping = 0.8;
const shelfWallGap = 0.08;
const shelfScale = 0.85;
const shelfRotationY = -Math.PI / 2;
const shelfHeightOffset = 0.3;
const gunViewRotation = new THREE.Euler(0, -Math.PI / 2, 0);
const gunAimLimits = {
  maxYaw: THREE.MathUtils.degToRad(34),
  maxPitch: THREE.MathUtils.degToRad(30),
};
const gunViewMaxSize = 0.65;
const gunForwardPointOffset = new THREE.Vector3(-0.46, 0.03, 0);
const gunForwardPointRadius = 0.04;
const bulletSpeed = 32;
const bulletLifetime = 8;
const maxActiveBullets = 30;
const bulletSpawnOffset = 0.08;
const bulletScale = 0.0125;
const bulletColliderMinRadius = 0.025;
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

function keepCameraChildLevelWithWorld(child, camera, worldQuaternion) {
  camera.updateWorldMatrix(true, false);
  child.quaternion
    .copy(camera.getWorldQuaternion(new THREE.Quaternion()))
    .invert()
    .multiply(worldQuaternion);
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
  keepCameraChildLevelWithWorld(table, camera, tableViewQuaternion);

  return { table, tableModel };
}

async function loadTent(scene) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(tentPath);
  const tent = gltf.scene;
  tent.name = 'visual-tent';

  tent.updateWorldMatrix(true, true);
  const tentBox = new THREE.Box3().setFromObject(tent);
  const tentCenter = tentBox.getCenter(new THREE.Vector3());
  const tentSize = tentBox.getSize(new THREE.Vector3());
  const tentMaxSize = Math.max(tentSize.x, tentSize.y, tentSize.z);
  const tentScale = tentMaxSize > 0 ? tentViewMaxSize / tentMaxSize : 1;

  tent.position.set(
    tentPosition.x - tentCenter.x * tentScale,
    tentPosition.y - tentBox.min.y * tentScale,
    tentPosition.z - tentCenter.z * tentScale,
  );
  tent.rotation.copy(tentRotation);
  tent.scale.setScalar(tentScale);

  tent.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(tent);

  return { tent, tentScale };
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

  const bulletRadius = Math.max(
    (Math.max(bulletSize.x, bulletSize.y, bulletSize.z) * bulletScale) / 2,
    bulletColliderMinRadius,
  );

  return { model: bulletModel, radius: bulletRadius };
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
    RAPIER.ColliderDesc.ball(bulletTemplate.radius).setRestitution(0.1),
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

function getMeshColliderData(mesh, root = null) {
  const geometry = mesh.geometry;
  const positionAttribute = geometry?.attributes?.position;

  if (!positionAttribute || positionAttribute.count < 3) {
    return null;
  }

  mesh.updateWorldMatrix(true, false);
  root?.updateWorldMatrix(true, false);

  const rootInverseMatrix = root
    ? new THREE.Matrix4().copy(root.matrixWorld).invert()
    : null;
  const vertices = new Float32Array(positionAttribute.count * 3);
  const vertex = new THREE.Vector3();

  for (let index = 0; index < positionAttribute.count; index += 1) {
    vertex.fromBufferAttribute(positionAttribute, index).applyMatrix4(mesh.matrixWorld);

    if (rootInverseMatrix) {
      vertex.applyMatrix4(rootInverseMatrix);
    }

    vertices[index * 3] = vertex.x;
    vertices[index * 3 + 1] = vertex.y;
    vertices[index * 3 + 2] = vertex.z;
  }

  const sourceIndex = geometry.index;
  const indices = sourceIndex
    ? new Uint32Array(sourceIndex.array)
    : Uint32Array.from({ length: positionAttribute.count }, (_, index) => index);

  if (indices.length < 3) {
    return null;
  }

  return { vertices, indices };
}

function createMeshTrimeshCollider(world, body, mesh, root = null) {
  const colliderData = getMeshColliderData(mesh, root);

  if (!colliderData) {
    return null;
  }

  const collider = world.createCollider(
    RAPIER.ColliderDesc.trimesh(colliderData.vertices, colliderData.indices),
    body,
  );
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return collider;
}

function createMeshConvexHullCollider(world, body, mesh, root = null) {
  const colliderData = getMeshColliderData(mesh, root);
  const colliderDesc = colliderData
    ? RAPIER.ColliderDesc.convexHull(colliderData.vertices)
    : null;

  if (!colliderDesc) {
    return null;
  }

  const collider = world.createCollider(colliderDesc, body);
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  collider.setRestitution(0.2);

  return collider;
}

function createModelTrimeshColliders(world, model) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
  const colliders = [];

  model.updateWorldMatrix(true, true);
  model.traverse((child) => {
    if (child.isMesh) {
      const collider = createMeshTrimeshCollider(world, body, child);

      if (collider) {
        colliders.push(collider);
      }
    }
  });

  return { body, colliders };
}

async function loadWall(scene, world) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(wallPath);
  const wall = gltf.scene;
  wall.name = 'collision-wall';
  wall.position.set(0, 0, -2.5);
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

async function loadShelf(scene, world, wallBox) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(shelfPath);
  const shelf = gltf.scene;
  shelf.name = 'collision-shelf';

  shelf.scale.setScalar(shelfScale);
  shelf.rotation.y = shelfRotationY;
  shelf.updateWorldMatrix(true, true);

  const transformedShelfBox = new THREE.Box3().setFromObject(shelf);
  const shelfCenter = transformedShelfBox.getCenter(new THREE.Vector3());
  const wallCenter = wallBox.getCenter(new THREE.Vector3());

  shelf.position.set(
    wallCenter.x - shelfCenter.x,
    -transformedShelfBox.min.y + shelfHeightOffset,
    wallBox.max.z + shelfWallGap - transformedShelfBox.min.z,
  );

  shelf.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(shelf);
  shelf.updateWorldMatrix(true, true);

  const shelfBox = new THREE.Box3().setFromObject(shelf);
  const { body: shelfBody, colliders: shelfColliders } = createModelTrimeshColliders(
    world,
    shelf,
  );

  return { shelf, shelfBody, shelfColliders, shelfBox };
}

async function loadPrize(scene, world) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(prizePath);
  const prizeModel = gltf.scene;
  const prize = new THREE.Group();
  prize.name = 'dynamic-prize';

  prizeModel.updateWorldMatrix(true, true);
  const prizeBox = new THREE.Box3().setFromObject(prizeModel);
  const prizeCenter = prizeBox.getCenter(new THREE.Vector3());
  const prizeSize = prizeBox.getSize(new THREE.Vector3());
  const prizeMaxSize = Math.max(prizeSize.x, prizeSize.y, prizeSize.z);
  const prizeScale = prizeMaxSize > 0 ? prizeViewMaxSize / prizeMaxSize : 1;

  prizeModel.position.set(
    -prizeCenter.x * prizeScale,
    -prizeBox.min.y * prizeScale,
    -prizeCenter.z * prizeScale,
  );
  prizeModel.scale.setScalar(prizeScale);
  prize.add(prizeModel);
  prize.position.copy(prizePosition);
  prize.rotation.copy(prizeRotation);

  prize.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  scene.add(prize);
  prize.updateWorldMatrix(true, true);

  const prizeQuaternion = new THREE.Quaternion().setFromEuler(prizeRotation);
  const prizeBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(prizePosition.x, prizePosition.y, prizePosition.z)
      .setRotation({
        x: prizeQuaternion.x,
        y: prizeQuaternion.y,
        z: prizeQuaternion.z,
        w: prizeQuaternion.w,
      })
      .setCcdEnabled(true)
      .setLinearDamping(prizeLinearDamping)
      .setAngularDamping(prizeAngularDamping),
  );
  const prizeColliders = [];

  prize.traverse((child) => {
    if (child.isMesh) {
      const collider = createMeshConvexHullCollider(world, prizeBody, child, prize);

      if (collider) {
        prizeColliders.push(collider);
      }
    }
  });

  return { prize, prizeModel, prizeBody, prizeColliders };
}

function syncPrizeMesh(prize) {
  const position = prize.prizeBody.translation();
  const rotation = prize.prizeBody.rotation();

  prize.prize.position.set(position.x, position.y, position.z);
  prize.prize.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
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

  status.textContent = '壁モデル、棚モデル、景品モデル、テントモデル、テーブルモデル、銃モデル、弾モデル、UIリングを読み込み中...';
  const ring = setupRingUi();
  const wall = await loadWall(scene, world);
  const shelf = await loadShelf(scene, world, wall.wallBox);
  const prize = await loadPrize(scene, world);
  const tent = await loadTent(scene);
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
    syncPrizeMesh(prize);
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
    shelf,
    prize,
    tent,
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
  status.textContent = '壁モデル、棚モデル、景品モデル、テントモデル、テーブルモデル、銃モデル、弾モデル、UIリング、またはライブラリの読み込みに失敗しました。';
});
