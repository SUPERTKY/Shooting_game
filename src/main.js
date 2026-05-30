import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

const canvasContainer = document.querySelector('#booth-canvas');
const ringUi = document.querySelector('#target-ring-ui');
const ringImage = document.querySelector('#target-ring-image');
const ringTraceArea = document.querySelector('#target-ring-trace-area');
const actionButton = document.querySelector('#action-button');
const cooldownGaugeFill = document.querySelector('#cooldown-gauge-fill');
const wallPath = './assets/wall.glb';
const launcherPath = './assets/launcher.glb';
const tokenPath = './assets/token.glb';
const popSoundPath = './Sound/pop.mp3';
const tablePath = './assets/Table.glb';
const groundPath = './assets/Ground.glb';
const shelfPath = './assets/shelf.glb';
const tentPath = './assets/Tent.glb';
const treePaths = {
  tree1: './tree/tree_1.glb',
  tree2: './tree/tree_2.glb',
};
// 学校PC向けの低負荷モード。見た目を増やしたい場合は各値を調整する。
const maxPrizeCount = 6;
const enabledPrizeTypeIds = [4, 8, 10];
const loadDecorativeTrees = false;
const useSimpleGround = true;
const enableFillLight = false;
const defaultPrizeSize = 0.15;
const defaultPrizeSlotSizeScale = 1;
const defaultPrizeHeightOffset = 0;
const prizeRespawnMinDelay = 7;
const prizeRespawnMaxDelay = 12;
const createPrizeTypeConfig = (id, {
  size = defaultPrizeSize,
  heightOffset = defaultPrizeHeightOffset,
  rotation = new THREE.Euler(0, 0, 0),
} = {}) => ({
  id,
  path: `./Prize/Prize_${id}.glb`,
  size,
  heightOffset,
  rotation,
});
const createPrizeSlotConfig = (id, position, {
  rotation = new THREE.Euler(0, 0, 0),
  sizeScale = defaultPrizeSlotSizeScale,
} = {}) => ({
  id,
  position,
  rotation,
  sizeScale,
});
const wallRotationY = Math.PI / 2;
const ringTraceAreaScale = 0.8;
const cameraViewHeightRatio = 0.44;
const cameraBackDistanceMultiplier = 2.1;
const cameraHorizontalOffset = -0.22;
const launcherViewPosition = new THREE.Vector3(0.18, -0.12, -0.55);
const tableViewPosition = new THREE.Vector3(0, -0.4, -0.5);
const tableViewRotation = new THREE.Euler(0, 0, 0);
const tableViewQuaternion = new THREE.Quaternion().setFromEuler(tableViewRotation);
const tableViewMaxSize = 1;
const tentPosition = new THREE.Vector3(0, 0, -2);
const tentRotation = new THREE.Euler(0, 0, 0);
const tentViewMaxSize = 2;
const groundViewMaxSize = 16;
const simpleGroundDepth = 0.1;
const groundPosition = new THREE.Vector3(0, 0, 0);
const treeViewMaxSize = 2.4;
const createTreeConfig = (id, path, position, rotationY = 0) => ({
  id,
  path,
  position,
  rotation: new THREE.Euler(0, rotationY, 0),
});
const treeConfigs = [
  createTreeConfig(
    'tree-1-left',
    treePaths.tree1,
    new THREE.Vector3(-3.2, 0, -1.4),
    Math.PI * 0.12,
  ),
  createTreeConfig(
    'tree-1-back-left',
    treePaths.tree1,
    new THREE.Vector3(-2.35, 0, -4.2),
    -Math.PI * 0.18,
  ),
  createTreeConfig(
    'tree-2-right',
    treePaths.tree2,
    new THREE.Vector3(3.2, 0, -1.4),
    -Math.PI * 0.14,
  ),
  createTreeConfig(
    'tree-2-back-right',
    treePaths.tree2,
    new THREE.Vector3(2.35, 0, -4.2),
    Math.PI * 0.2,
  ),
];
const skyTexturePath = './image/sky.jpg';
const pointImagePath = './image/Point.png';
// 景品タイプは Prize/Prize_1.glb から Prize/Prize_10.glb まで対応します。
// 未追加・読み込み失敗のファイルはスキップし、読み込めたタイプだけをランダム配置に使います。
// prizeSizeByTypeId に景品タイプごとの見た目サイズを設定できます。
// 数値はモデルの最大辺をそろえるサイズ、THREE.Vector3 は幅・高さ・奥行きを個別指定するサイズです。
// Prize_1 から Prize_10 までの表示位置の高さを変えたい場合は prizeHeightOffsetByTypeId の値を変更します。
// 正の数を指定すると上方向へ、負の数を指定すると下方向へ移動します。
const prizeSizeByTypeId = {
  1: 0.15,
  2: 0.3,
  3: 0.2,
  4: 0.15,
  5: 0.15,
  6: 0.15,
  7: 0.15,
  8: 0.15,
  9: 0.15,
  10: 0.15,
};
const prizeHeightOffsetByTypeId = {
  1: -0.08,
  2: -0.1,
  3: -0.1,
  4: -0.1,
  5: -0.1,
  6: -0.1,
  7: -0.08,
  8: -0.06,
  9: -0.1,
  10: -0.12,
};
const prizeTypeConfigs = enabledPrizeTypeIds.map((id) => (
  createPrizeTypeConfig(id, {
    size: prizeSizeByTypeId[id] ?? defaultPrizeSize,
    heightOffset: prizeHeightOffsetByTypeId[id] ?? defaultPrizeHeightOffset,
  })
));
// sizeScale は配置スロットごとの倍率です。
// 同じ景品タイプでも置き場所ごとに大きさを変えたい場合に指定します。
const prizeSlotConfigs = [
  createPrizeSlotConfig(1, new THREE.Vector3(-0.5, 0.43, -1.43), { sizeScale: 1 }),
  createPrizeSlotConfig(2, new THREE.Vector3(0, 0.43, -1.43), { sizeScale: 1 }),
  createPrizeSlotConfig(3, new THREE.Vector3(0.5, 0.43, -1.43), { sizeScale: 1 }),
  createPrizeSlotConfig(4, new THREE.Vector3(-0.5, 0.57, -1.8), { sizeScale: 1 }),
  createPrizeSlotConfig(5, new THREE.Vector3(0, 0.57, -1.8), { sizeScale: 1 }),
  createPrizeSlotConfig(6, new THREE.Vector3(0.5, 0.57, -1.8), { sizeScale: 1 }),
  createPrizeSlotConfig(7, new THREE.Vector3(-0.7, 0.72, -2.13), { sizeScale: 1 }),
  createPrizeSlotConfig(8, new THREE.Vector3(-0.3, 0.72, -2.13), { sizeScale: 1 }),
  createPrizeSlotConfig(9, new THREE.Vector3(0.3, 0.72, -2.13), { sizeScale: 1 }),
  createPrizeSlotConfig(10, new THREE.Vector3(0.7, 0.72, -2.13), { sizeScale: 1 }),
].slice(0, maxPrizeCount);
const prizeLinearDamping = 0.35;
const prizeAngularDamping = 0.8;
const prizeHitVelocityMultiplier = 0.16;
const prizeDropScoreHeight = 0.3;
const maxRendererPixelRatio = 0.5;
// 低性能な学校PCでも安定しやすいよう、描画と物理更新を24fpsに抑える。
const targetFrameRate = 24;
const targetFrameDuration = 1000 / targetFrameRate;
const maxFrameDelta = 0.05;
const enableRealtimeShadows = false;
const textureAnisotropy = 1;
const pointPopupLifetime = 0.85;
const pointPopupSize = 'min(28vmin, 190px)';
const pointPopupScreenPadding = 96;
const pointPopupMinRotation = -90;
const pointPopupMaxRotation = 90;
const shelfWallGap = 0.28;
const shelfScale = 0.85;
const shelfRotationY = -Math.PI / 2;
const shelfHeightOffset = 0.3;
const launcherViewRotation = new THREE.Euler(0, -Math.PI / 2, 0);
const launcherAimLimits = {
  maxYaw: THREE.MathUtils.degToRad(34),
  maxPitch: THREE.MathUtils.degToRad(30),
};
const launcherViewMaxSize = 0.65;
const launcherForwardPointOffset = new THREE.Vector3(-0.46, 0.03, 0);
const tokenSpeed = 20;
const tokenLifetime = 6;
const maxActiveTokens = 12;
const tokenSpawnOffset = 0.08;
const tokenScale = 0.0065;
const tokenColliderMinRadius = 0.025;
const tokenTrailPointCount = 8;
const tokenTrailSpacing = 0.045;
const tokenTrailColor = 0xffffff;
const tokenTrailOpacity = 0.72;
const actionCooldownDuration = 1;
const launcherForwardDirection = new THREE.Vector3(-1, 0, 0);
const collisionGroups = {
  environment: 0x0001,
  token: 0x0002,
  prize: 0x0004,
  tent: 0x0008,
};
const environmentCollisionGroup = createCollisionGroup(
  collisionGroups.environment,
  collisionGroups.environment | collisionGroups.token | collisionGroups.prize,
);
const tokenCollisionGroup = createCollisionGroup(
  collisionGroups.token,
  collisionGroups.environment | collisionGroups.prize | collisionGroups.tent,
);
const prizeCollisionGroup = createCollisionGroup(
  collisionGroups.prize,
  collisionGroups.environment | collisionGroups.token | collisionGroups.prize,
);
// テントはコマとだけ衝突する専用グループにして、景品や地面などには反応させない。
const tentCollisionGroup = createCollisionGroup(
  collisionGroups.tent,
  collisionGroups.token,
);
const prizeBottomMatrix = new THREE.Matrix4();
const prizeBottomPosition = new THREE.Vector3();
const prizeBottomQuaternion = new THREE.Quaternion();
const prizeBottomScale = new THREE.Vector3(1, 1, 1);
const prizeBottomCorner = new THREE.Vector3();

function getViewportSize() {
  const visualViewport = window.visualViewport;
  const viewportWidth = visualViewport?.width
    ?? window.innerWidth
    ?? document.documentElement.clientWidth
    ?? 1;
  const viewportHeight = visualViewport?.height
    ?? window.innerHeight
    ?? document.documentElement.clientHeight
    ?? 1;
  const width = Math.max(Math.round(viewportWidth), 1);
  const height = Math.max(Math.round(viewportHeight), 1);

  return { width, height };
}

function getViewportAspect() {
  const { width, height } = getViewportSize();

  return width / height;
}

function setRendererViewport(renderer) {
  const { width, height } = getViewportSize();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRendererPixelRatio));
  renderer.setSize(width, height);
}

function createCollisionGroup(memberships, filters) {
  return (memberships << 16) | filters;
}

function createRenderer() {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  setRendererViewport(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = enableRealtimeShadows;
  renderer.shadowMap.autoUpdate = false;
  canvasContainer.appendChild(renderer.domElement);

  return renderer;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60,
    getViewportAspect(),
    0.1,
    100,
  );
  camera.position.set(0, 0, 8.5);
  camera.lookAt(0, 1.4, 0);

  return camera;
}


function freezeStaticObjectMatrices(object) {
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    child.matrixAutoUpdate = false;
  });
}

function hasActiveTokens(tokens) {
  return tokens.length > 0;
}

function hasAwakeDynamicPrizes(prizes) {
  return prizes.some((prize) => {
    if (!prize.isDynamic) {
      return false;
    }

    return typeof prize.prizeBody.isSleeping === 'function'
      ? !prize.prizeBody.isSleeping()
      : true;
  });
}

function hasPendingVisualWork(tokens, prizes, ring) {
  return hasActiveTokens(tokens)
    || hasAwakeDynamicPrizes(prizes)
    || ring.needsRender;
}

function optimizeTextureMemory(texture, {
  useMipmaps = true,
  anisotropy = textureAnisotropy,
} = {}) {
  if (!texture) {
    return;
  }

  texture.generateMipmaps = useMipmaps;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
}

function optimizeModelTextureMemory(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      optimizeTextureMemory(material.map);
      optimizeTextureMemory(material.normalMap);
      optimizeTextureMemory(material.roughnessMap);
      optimizeTextureMemory(material.metalnessMap);
      optimizeTextureMemory(material.emissiveMap);
      optimizeTextureMemory(material.aoMap);
    });
  });
}


async function loadPointTexture() {
  const textureLoader = new THREE.TextureLoader();
  const pointTexture = await textureLoader.loadAsync(pointImagePath);
  pointTexture.colorSpace = THREE.SRGBColorSpace;
  optimizeTextureMemory(pointTexture, { useMipmaps: false });

  return pointTexture;
}

async function configureBackground(scene) {
  const textureLoader = new THREE.TextureLoader();
  const skyTexture = await textureLoader.loadAsync(skyTexturePath);
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  optimizeTextureMemory(skyTexture, { useMipmaps: false });
  scene.background = skyTexture;

  return { skyTexture };
}

function addLights(scene) {
  const ambientLight = new THREE.HemisphereLight(0xffffff, 0x8fc8ff, 1.9);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 6, -4);
  keyLight.castShadow = enableRealtimeShadows;
  scene.add(keyLight);

  const fillLight = enableFillLight
    ? new THREE.PointLight(0x80bfff, 25, 12)
    : null;

  if (fillLight) {
    fillLight.position.set(-3, 2.5, 3);
    scene.add(fillLight);
  }

  return { ambientLight, keyLight, fillLight };
}

function createSimpleGround(scene, world) {
  const groundGeometry = new THREE.PlaneGeometry(groundViewMaxSize, groundViewMaxSize);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x6f9149 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.name = 'simple-visual-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.copy(groundPosition);
  ground.receiveShadow = false;
  scene.add(ground);
  freezeStaticObjectMatrices(ground);

  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(
      groundPosition.x,
      groundPosition.y - simpleGroundDepth / 2,
      groundPosition.z,
    ),
  );
  const groundCollider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      groundViewMaxSize / 2,
      simpleGroundDepth / 2,
      groundViewMaxSize / 2,
    ).setCollisionGroups(environmentCollisionGroup),
    groundBody,
  );
  groundCollider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return {
    ground,
    groundScale: 1,
    groundBody,
    groundCollider,
    groundColliders: [groundCollider],
  };
}

async function loadGround(scene, world) {
  if (useSimpleGround) {
    return createSimpleGround(scene, world);
  }

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(groundPath);
  const ground = gltf.scene;
  optimizeModelTextureMemory(ground);
  ground.name = 'visual-ground';

  ground.updateWorldMatrix(true, true);
  const groundBox = new THREE.Box3().setFromObject(ground);
  const groundCenter = groundBox.getCenter(new THREE.Vector3());
  const groundSize = groundBox.getSize(new THREE.Vector3());
  const groundMaxSize = Math.max(groundSize.x, groundSize.y, groundSize.z);
  const groundScale = groundMaxSize > 0 ? groundViewMaxSize / groundMaxSize : 1;

  ground.position.set(
    groundPosition.x - groundCenter.x * groundScale,
    groundPosition.y - groundBox.min.y * groundScale,
    groundPosition.z - groundCenter.z * groundScale,
  );
  ground.scale.setScalar(groundScale);

  ground.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  scene.add(ground);
  ground.updateWorldMatrix(true, true);

  const { body: groundBody, colliders: groundColliders } = createModelTrimeshColliders(
    world,
    ground,
  );
  const groundCollider = groundColliders[0] ?? null;
  freezeStaticObjectMatrices(ground);

  return { ground, groundScale, groundBody, groundCollider, groundColliders };
}

function frameObjectInView(object, camera) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  const distance = maxSize / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  const viewHeight = center.y + size.y * cameraViewHeightRatio;

  const cameraX = center.x + cameraHorizontalOffset;

  camera.position.set(cameraX, viewHeight, center.z + distance * cameraBackDistanceMultiplier);
  camera.lookAt(cameraX, viewHeight, center.z);
  camera.updateProjectionMatrix();
}

function keepCameraChildLevelWithWorld(child, camera, worldQuaternion) {
  camera.updateWorldMatrix(true, false);
  child.quaternion
    .copy(camera.getWorldQuaternion(new THREE.Quaternion()))
    .invert()
    .multiply(worldQuaternion);
}

function createLauncherLaunchPointAnchor(launcherScale) {
  const anchorScale = launcherScale > 0 ? launcherScale : 1;
  const launchPointAnchor = new THREE.Object3D();
  launchPointAnchor.name = 'launcher-launchPoint-anchor';
  launchPointAnchor.position.copy(launcherForwardPointOffset).divideScalar(anchorScale);

  return launchPointAnchor;
}

async function loadTable(camera) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(tablePath);
  const tableModel = gltf.scene;
  optimizeModelTextureMemory(tableModel);
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
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  camera.add(table);
  keepCameraChildLevelWithWorld(table, camera, tableViewQuaternion);
  freezeStaticObjectMatrices(table);

  return { table, tableModel };
}

async function loadTreeTemplate(path, loader, templateCache) {
  if (templateCache.has(path)) {
    return templateCache.get(path);
  }

  const gltf = await loader.loadAsync(path);
  const treeTemplate = gltf.scene;
  optimizeModelTextureMemory(treeTemplate);
  templateCache.set(path, treeTemplate);

  return treeTemplate;
}

async function loadTree(scene, config, loader, templateCache) {
  const treeTemplate = await loadTreeTemplate(config.path, loader, templateCache);
  const treeModel = treeTemplate.clone(true);
  const tree = new THREE.Group();
  tree.name = `decorative-${config.id}`;

  treeModel.updateWorldMatrix(true, true);
  const treeBox = new THREE.Box3().setFromObject(treeModel);
  const treeCenter = treeBox.getCenter(new THREE.Vector3());
  const treeSize = treeBox.getSize(new THREE.Vector3());
  const treeMaxSize = Math.max(treeSize.x, treeSize.y, treeSize.z);
  const treeScale = treeMaxSize > 0 ? treeViewMaxSize / treeMaxSize : 1;

  treeModel.position.set(
    -treeCenter.x * treeScale,
    -treeBox.min.y * treeScale,
    -treeCenter.z * treeScale,
  );
  treeModel.scale.setScalar(treeScale);
  tree.add(treeModel);
  tree.position.copy(config.position);
  tree.rotation.copy(config.rotation);

  tree.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  scene.add(tree);
  freezeStaticObjectMatrices(tree);

  return { config, tree, treeModel, treeScale };
}

async function loadTrees(scene) {
  const loader = new GLTFLoader();
  const templateCache = new Map();
  const loadedTrees = [];

  for (const config of treeConfigs) {
    loadedTrees.push(await loadTree(scene, config, loader, templateCache));
  }

  return loadedTrees;
}

async function loadTent(scene, world) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(tentPath);
  const tent = gltf.scene;
  optimizeModelTextureMemory(tent);
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
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  scene.add(tent);
  tent.updateWorldMatrix(true, true);

  const { body: tentBody, colliders: tentColliders } = createModelTrimeshColliders(
    world,
    tent,
    tentCollisionGroup,
  );
  freezeStaticObjectMatrices(tent);

  return { tent, tentScale, tentBody, tentColliders };
}

async function loadLauncher(camera) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(launcherPath);
  const launcherModel = gltf.scene;
  optimizeModelTextureMemory(launcherModel);
  const launcher = new THREE.Group();
  launcher.name = 'camera-launcher';

  launcherModel.updateWorldMatrix(true, true);
  const launcherBox = new THREE.Box3().setFromObject(launcherModel);
  const launcherCenter = launcherBox.getCenter(new THREE.Vector3());
  const launcherSize = launcherBox.getSize(new THREE.Vector3());
  const launcherMaxSize = Math.max(launcherSize.x, launcherSize.y, launcherSize.z);
  const launcherScale = launcherMaxSize > 0 ? launcherViewMaxSize / launcherMaxSize : 1;

  launcherModel.position.sub(launcherCenter);
  launcher.add(launcherModel);
  launcher.scale.setScalar(launcherScale);
  launcher.position.copy(launcherViewPosition);
  launcher.rotation.copy(launcherViewRotation);

  launcher.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  const launchPointAnchor = createLauncherLaunchPointAnchor(launcherScale);
  launcher.add(launchPointAnchor);

  camera.add(launcher);

  return { launcher, launcherModel, launchPointAnchor };
}


async function loadTokenTemplate() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(tokenPath);
  const tokenModel = gltf.scene;
  optimizeModelTextureMemory(tokenModel);
  tokenModel.name = 'token-template';

  tokenModel.updateWorldMatrix(true, true);
  const tokenBox = new THREE.Box3().setFromObject(tokenModel);
  const tokenCenter = tokenBox.getCenter(new THREE.Vector3());
  const tokenSize = tokenBox.getSize(new THREE.Vector3());

  tokenModel.position.sub(tokenCenter);
  tokenModel.scale.setScalar(tokenScale);
  tokenModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });

  const tokenRadius = Math.max(
    (Math.max(tokenSize.x, tokenSize.y, tokenSize.z) * tokenScale) / 2,
    tokenColliderMinRadius,
  );

  return { model: tokenModel, radius: tokenRadius };
}

function getLauncherLaunchPointWorldTransform(launcher) {
  const launchPointPosition = new THREE.Vector3();
  const launcherQuaternion = new THREE.Quaternion();
  const launchPointDirection = launcherForwardDirection.clone();

  launcher.launchPointAnchor.getWorldPosition(launchPointPosition);
  launcher.launcher.getWorldQuaternion(launcherQuaternion);
  launchPointDirection.applyQuaternion(launcherQuaternion).normalize();
  launchPointPosition.addScaledVector(launchPointDirection, tokenSpawnOffset);

  return { launchPointPosition, launchPointDirection };
}


function createPopSound() {
  const popSound = new Audio(popSoundPath);
  popSound.preload = 'auto';

  return popSound;
}

function playPopSound(popSound) {
  const sound = popSound.cloneNode();
  sound.currentTime = 0;
  sound.play().catch((error) => {
    console.warn('効果音の再生に失敗しました。', error);
  });
}

function createTokenTrail(launchPointPosition, launchPointDirection) {
  const trailPositions = Array.from({ length: tokenTrailPointCount }, (_, index) => (
    launchPointPosition.clone().addScaledVector(launchPointDirection, -tokenTrailSpacing * index)
  ));
  const trailPositionBuffer = new Float32Array(tokenTrailPointCount * 3);
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.LineBasicMaterial({
    color: tokenTrailColor,
    transparent: true,
    opacity: tokenTrailOpacity,
    depthWrite: false,
  });
  const trail = new THREE.Line(trailGeometry, trailMaterial);
  trail.name = 'token-white-trail';
  trail.frustumCulled = false;
  trail.renderOrder = 1;

  updateTrailGeometry(trail, trailPositions, trailPositionBuffer);

  return {
    line: trail,
    positions: trailPositions,
    positionBuffer: trailPositionBuffer,
  };
}

function updateTrailGeometry(trail, trailPositions, trailPositionBuffer) {
  trailPositions.forEach((position, index) => {
    const offset = index * 3;
    trailPositionBuffer[offset] = position.x;
    trailPositionBuffer[offset + 1] = position.y;
    trailPositionBuffer[offset + 2] = position.z;
  });

  const positionAttribute = trail.geometry.getAttribute('position');
  if (positionAttribute) {
    positionAttribute.needsUpdate = true;
  } else {
    trail.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(trailPositionBuffer, 3),
    );
  }
}

function updateTokenTrail(token) {
  const positions = token.trail.positions;

  for (let index = positions.length - 1; index > 0; index -= 1) {
    positions[index].copy(positions[index - 1]);
  }

  positions[0].copy(token.mesh.position);
  updateTrailGeometry(
    token.trail.line,
    positions,
    token.trail.positionBuffer,
  );
}

function disposeTokenTrail(trail) {
  trail.line.geometry.dispose();
  trail.line.material.dispose();
}

function createToken(scene, world, tokenTemplate, launcher, tokenColliderHandleMap) {
  const { launchPointPosition, launchPointDirection } = getLauncherLaunchPointWorldTransform(launcher);
  const token = tokenTemplate.model.clone(true);
  const tokenRotation = new THREE.Quaternion().setFromUnitVectors(
    launcherForwardDirection,
    launchPointDirection,
  );
  token.name = 'physics-token';
  token.position.copy(launchPointPosition);
  token.quaternion.copy(tokenRotation);
  scene.add(token);

  const trail = createTokenTrail(launchPointPosition, launchPointDirection);
  scene.add(trail.line);

  const tokenBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(launchPointPosition.x, launchPointPosition.y, launchPointPosition.z)
      .setRotation({
        x: tokenRotation.x,
        y: tokenRotation.y,
        z: tokenRotation.z,
        w: tokenRotation.w,
      })
      .setCcdEnabled(true)
      .setLinearDamping(0.02)
      .setAngularDamping(0.2),
  );
  tokenBody.setLinvel(
    {
      x: launchPointDirection.x * tokenSpeed,
      y: launchPointDirection.y * tokenSpeed,
      z: launchPointDirection.z * tokenSpeed,
    },
    true,
  );

  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(tokenTemplate.radius)
      .setRestitution(0.1)
      .setCollisionGroups(tokenCollisionGroup),
    tokenBody,
  );
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  const createdToken = {
    mesh: token,
    body: tokenBody,
    collider,
    trail,
    age: 0,
  };

  tokenColliderHandleMap.set(collider.handle, createdToken);

  return createdToken;
}

function syncTokenMeshes(tokens) {
  tokens.forEach((token) => {
    const position = token.body.translation();
    const rotation = token.body.rotation();

    token.mesh.position.set(position.x, position.y, position.z);
    token.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    updateTokenTrail(token);
  });
}

function removeToken(scene, world, token, tokenColliderHandleMap = null) {
  tokenColliderHandleMap?.delete(token.collider.handle);
  scene.remove(token.mesh);
  scene.remove(token.trail.line);
  disposeTokenTrail(token.trail);
  world.removeRigidBody(token.body);
}

function pruneTokens(scene, world, tokens, delta, tokenColliderHandleMap) {
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    token.age += delta;

    if (token.age > tokenLifetime || token.mesh.position.y < -4) {
      removeToken(scene, world, token, tokenColliderHandleMap);
      tokens.splice(index, 1);
    }
  }

  while (tokens.length > maxActiveTokens) {
    const token = tokens.shift();
    removeToken(scene, world, token, tokenColliderHandleMap);
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

function createMeshTrimeshCollider(
  world,
  body,
  mesh,
  root = null,
  collisionGroup = environmentCollisionGroup,
) {
  const colliderData = getMeshColliderData(mesh, root);

  if (!colliderData) {
    return null;
  }

  const collider = world.createCollider(
    RAPIER.ColliderDesc.trimesh(colliderData.vertices, colliderData.indices)
      .setCollisionGroups(collisionGroup),
    body,
  );
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);

  return collider;
}

function createMeshConvexHullCollider(
  world,
  body,
  mesh,
  root = null,
  collisionGroup = prizeCollisionGroup,
) {
  const colliderData = getMeshColliderData(mesh, root);
  const colliderDesc = colliderData
    ? RAPIER.ColliderDesc.convexHull(colliderData.vertices)
    : null;

  if (!colliderDesc) {
    return null;
  }

  colliderDesc.setCollisionGroups(collisionGroup);
  const collider = world.createCollider(colliderDesc, body);
  collider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  collider.setRestitution(0.2);

  return collider;
}

function createModelTrimeshColliders(
  world,
  model,
  collisionGroup = environmentCollisionGroup,
) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
  const colliders = [];

  model.updateWorldMatrix(true, true);
  model.traverse((child) => {
    if (child.isMesh) {
      const collider = createMeshTrimeshCollider(world, body, child, null, collisionGroup);

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
  optimizeModelTextureMemory(wall);
  wall.name = 'collision-wall';
  wall.position.set(0, 0, -2.5);
  wall.rotation.y = wallRotationY;

  wall.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
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
    RAPIER.ColliderDesc.cuboid(wallSize.x / 2, wallSize.y / 2, wallSize.z / 2)
      .setCollisionGroups(environmentCollisionGroup),
    wallBody,
  );
  wallCollider.setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL);
  freezeStaticObjectMatrices(wall);

  return { wall, wallBody, wallCollider, wallBox };
}

async function loadShelf(scene, world, wallBox) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(shelfPath);
  const shelf = gltf.scene;
  optimizeModelTextureMemory(shelf);
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
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  scene.add(shelf);
  shelf.updateWorldMatrix(true, true);

  const shelfBox = new THREE.Box3().setFromObject(shelf);
  const { body: shelfBody, colliders: shelfColliders } = createModelTrimeshColliders(
    world,
    shelf,
  );
  freezeStaticObjectMatrices(shelf);

  return { shelf, shelfBody, shelfColliders, shelfBox };
}

function getPrizeScale(size, maxSourceSize) {
  if (size instanceof THREE.Vector3) {
    const baseScale = maxSourceSize > 0 ? 1 / maxSourceSize : 1;

    return size.clone().multiplyScalar(baseScale);
  }

  const targetSize = Number.isFinite(size) ? size : defaultPrizeSize;
  const uniformScale = maxSourceSize > 0 ? targetSize / maxSourceSize : 1;

  return new THREE.Vector3(uniformScale, uniformScale, uniformScale);
}

function applyPrizeSlotSizeScale(prizeModel, sizeScale) {
  if (sizeScale instanceof THREE.Vector3) {
    prizeModel.scale.multiply(sizeScale);

    return;
  }

  const uniformSizeScale = Number.isFinite(sizeScale) ? sizeScale : defaultPrizeSlotSizeScale;
  prizeModel.scale.multiplyScalar(uniformSizeScale);
}


function getBoxCorners(box) {
  return [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];
}

function createLocalBoundingCorners(object) {
  object.updateWorldMatrix(true, true);

  const worldBox = new THREE.Box3().setFromObject(object);
  const inverseWorldMatrix = new THREE.Matrix4().copy(object.matrixWorld).invert();

  return getBoxCorners(worldBox).map((corner) => corner.applyMatrix4(inverseWorldMatrix));
}

function getPrizeBottomY(prize) {
  const position = prize.prizeBody.translation();
  const rotation = prize.prizeBody.rotation();
  prizeBottomPosition.set(position.x, position.y, position.z);
  prizeBottomQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  prizeBottomMatrix.compose(prizeBottomPosition, prizeBottomQuaternion, prizeBottomScale);

  return prize.localBoundingCorners.reduce((lowestY, corner) => {
    prizeBottomCorner.copy(corner).applyMatrix4(prizeBottomMatrix);

    return Math.min(lowestY, prizeBottomCorner.y);
  }, Infinity);
}

async function loadPrizeType(config, loader) {
  let gltf;

  try {
    gltf = await loader.loadAsync(config.path);
  } catch (error) {
    console.warn(`${config.path} が見つからない、または読み込めないためスキップします。`, error);

    return null;
  }

  const prizeModel = gltf.scene;
  optimizeModelTextureMemory(prizeModel);

  prizeModel.updateWorldMatrix(true, true);
  const prizeBox = new THREE.Box3().setFromObject(prizeModel);
  const prizeCenter = prizeBox.getCenter(new THREE.Vector3());
  const prizeSize = prizeBox.getSize(new THREE.Vector3());
  const prizeMaxSize = Math.max(prizeSize.x, prizeSize.y, prizeSize.z);
  const prizeScale = getPrizeScale(config.size, prizeMaxSize);
  const heightOffset = Number.isFinite(config.heightOffset)
    ? config.heightOffset
    : defaultPrizeHeightOffset;

  prizeModel.position.set(
    -prizeCenter.x * prizeScale.x,
    -prizeBox.min.y * prizeScale.y + heightOffset,
    -prizeCenter.z * prizeScale.z,
  );
  prizeModel.rotation.copy(config.rotation);
  prizeModel.scale.copy(prizeScale);

  prizeModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = enableRealtimeShadows;
      child.receiveShadow = enableRealtimeShadows;
    }
  });

  return { config, prizeModel };
}

async function loadPrizeTypes() {
  const loader = new GLTFLoader();
  const loadedPrizeTypes = await Promise.all(
    prizeTypeConfigs.map((config) => loadPrizeType(config, loader)),
  );

  return loadedPrizeTypes.filter(Boolean);
}

function getRandomArrayItem(items) {
  if (items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function createPrize(scene, world, prizeType, slot, prizeColliderHandleMap = null) {
  const prizeModel = prizeType.prizeModel.clone(true);
  applyPrizeSlotSizeScale(prizeModel, slot.sizeScale);

  const prize = new THREE.Group();
  prize.name = `dynamic-prize-slot-${slot.id}-type-${prizeType.config.id}`;
  prize.add(prizeModel);
  prize.position.copy(slot.position);
  prize.rotation.copy(slot.rotation);

  scene.add(prize);
  prize.updateWorldMatrix(true, true);

  const prizeQuaternion = new THREE.Quaternion().setFromEuler(slot.rotation);
  const prizeBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(slot.position.x, slot.position.y, slot.position.z)
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
        collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        prizeColliders.push(collider);
      }
    }
  });

  const localBoundingCorners = createLocalBoundingCorners(prize);

  const createdPrize = {
    config: prizeType.config,
    slot,
    prize,
    prizeModel,
    prizeBody,
    prizeColliders,
    localBoundingCorners,
    isDynamic: false,
  };

  prizeColliders.forEach((collider) => {
    prizeColliderHandleMap?.set(collider.handle, createdPrize);
  });

  return createdPrize;
}

function activatePrizePhysics(prize, token = null) {
  if (!prize || prize.isDynamic) {
    return;
  }

  prize.prizeBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  prize.prizeBody.setLinearDamping(prizeLinearDamping);
  prize.prizeBody.setAngularDamping(prizeAngularDamping);
  prize.prizeBody.wakeUp();
  prize.isDynamic = true;

  if (token) {
    const tokenVelocity = token.body.linvel();
    prize.prizeBody.setLinvel({
      x: tokenVelocity.x * prizeHitVelocityMultiplier,
      y: tokenVelocity.y * prizeHitVelocityMultiplier,
      z: tokenVelocity.z * prizeHitVelocityMultiplier,
    }, true);
  }
}

function hasSpawnedPrizeDisappeared(prize) {
  return !prize || !prize.prize.parent;
}

function getSpawnedPrizeInSlot(prizes, slot) {
  return prizes.find((prize) => (
    prize.slot.id === slot.id && !hasSpawnedPrizeDisappeared(prize)
  )) ?? null;
}

function isPrizeSlotOccupied(prizes, slot) {
  return Boolean(getSpawnedPrizeInSlot(prizes, slot));
}

function getEmptyPrizeSlots(prizes) {
  return prizeSlotConfigs.filter((slot) => !isPrizeSlotOccupied(prizes, slot));
}

function fillInitialPrizeSlots(scene, world, prizeTypes, prizeColliderHandleMap) {
  if (prizeTypes.length === 0) {
    return [];
  }

  return prizeSlotConfigs.map((slot) => (
    createPrize(scene, world, getRandomArrayItem(prizeTypes), slot, prizeColliderHandleMap)
  ));
}

function createPrizeRespawnQueue() {
  return [];
}

function createPrizePool() {
  return [];
}

function recyclePrize(scene, prizePool, prize) {
  prize.prizeBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  prize.prizeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  prize.prizeBody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  prize.prizeBody.setTranslation({ x: 0, y: -100, z: 0 }, true);
  prize.prizeBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  prize.prizeBody.sleep();
  prize.prizeColliders.forEach((collider) => collider.setEnabled(false));
  prize.isDynamic = false;
  scene.remove(prize.prize);

  prizePool.push(prize);
}

function acquirePrizeForSlot(
  scene,
  world,
  prizeType,
  slot,
  prizePool,
  prizeColliderHandleMap,
) {
  const pooledPrize = prizePool.pop() ?? null;

  if (!pooledPrize) {
    return createPrize(scene, world, prizeType, slot, prizeColliderHandleMap);
  }

  const prizeQuaternion = new THREE.Quaternion().setFromEuler(slot.rotation);
  pooledPrize.slot = slot;
  pooledPrize.prize.name = `dynamic-prize-slot-${slot.id}-type-${pooledPrize.config.id}`;
  pooledPrize.prize.position.copy(slot.position);
  pooledPrize.prize.rotation.copy(slot.rotation);
  scene.add(pooledPrize.prize);
  pooledPrize.prize.updateWorldMatrix(true, true);

  pooledPrize.prizeBody.setBodyType(RAPIER.RigidBodyType.Fixed, true);
  pooledPrize.prizeBody.setTranslation(
    { x: slot.position.x, y: slot.position.y, z: slot.position.z },
    true,
  );
  pooledPrize.prizeBody.setRotation(
    { x: prizeQuaternion.x, y: prizeQuaternion.y, z: prizeQuaternion.z, w: prizeQuaternion.w },
    true,
  );
  pooledPrize.prizeBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  pooledPrize.prizeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  pooledPrize.prizeBody.setLinearDamping(prizeLinearDamping);
  pooledPrize.prizeBody.setAngularDamping(prizeAngularDamping);
  pooledPrize.prizeColliders.forEach((collider) => collider.setEnabled(true));
  pooledPrize.isDynamic = false;

  return pooledPrize;
}

function schedulePrizeRespawn(respawnQueue, slot) {
  const hasPendingRespawn = respawnQueue.some((respawn) => respawn.slot.id === slot.id);

  if (hasPendingRespawn) {
    return;
  }

  respawnQueue.push({
    slot,
    remaining: THREE.MathUtils.randFloat(prizeRespawnMinDelay, prizeRespawnMaxDelay),
  });
}

function updatePrizeRespawns(
  scene,
  world,
  prizes,
  prizeTypes,
  respawnQueue,
  delta,
  prizeColliderHandleMap,
  prizePool,
) {
  if (prizeTypes.length === 0) {
    respawnQueue.length = 0;
    return false;
  }

  let spawnedPrize = false;

  for (let index = respawnQueue.length - 1; index >= 0; index -= 1) {
    const respawn = respawnQueue[index];
    respawn.remaining -= delta;

    if (respawn.remaining > 0) {
      continue;
    }

    const { slot } = respawn;

    if (isPrizeSlotOccupied(prizes, slot)) {
      continue;
    }

    const prizeType = getRandomArrayItem(prizeTypes);

    if (!prizeType) {
      respawnQueue.splice(index, 1);
      continue;
    }

    prizes.push(acquirePrizeForSlot(
      scene,
      world,
      prizeType,
      slot,
      prizePool,
      prizeColliderHandleMap,
    ));
    spawnedPrize = true;
    respawnQueue.splice(index, 1);
  }

  return spawnedPrize;
}

function createScoreState() {
  return {
    points: 0,
  };
}

function getRandomScreenPosition() {
  const { width, height } = getViewportSize();
  const minX = Math.min(pointPopupScreenPadding, width / 2);
  const minY = Math.min(pointPopupScreenPadding, height / 2);
  const maxX = Math.max(width - minX, minX);
  const maxY = Math.max(height - minY, minY);

  return {
    x: THREE.MathUtils.randFloat(minX, maxX),
    y: THREE.MathUtils.randFloat(minY, maxY),
  };
}

function createPointPopup(pointPopups) {
  const popup = document.createElement('img');
  const screenPosition = getRandomScreenPosition();
  const rotation = THREE.MathUtils.randFloat(
    pointPopupMinRotation,
    pointPopupMaxRotation,
  );

  popup.src = pointImagePath;
  popup.alt = '';
  popup.draggable = false;
  popup.className = 'point-popup';
  Object.assign(popup.style, {
    position: 'fixed',
    left: `${screenPosition.x}px`,
    top: `${screenPosition.y}px`,
    zIndex: '4',
    width: pointPopupSize,
    height: 'auto',
    pointerEvents: 'none',
    userSelect: 'none',
    transformOrigin: 'center',
    willChange: 'transform, opacity',
  });

  document.body.appendChild(popup);

  const baseTransform = `translate(-50%, -50%) rotate(${rotation}deg)`;
  const animation = popup.animate(
    [
      { opacity: 0, transform: `${baseTransform} scale(0.05)`, offset: 0 },
      { opacity: 1, transform: `${baseTransform} scale(1)`, offset: 0.58 },
      { opacity: 1, transform: `${baseTransform} scale(1.08)`, offset: 0.86 },
      { opacity: 0, transform: `${baseTransform} scale(0.02)`, offset: 1 },
    ],
    {
      duration: pointPopupLifetime * 1000,
      easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
      fill: 'forwards',
    },
  );

  const pointPopup = { element: popup, animation };
  pointPopups.push(pointPopup);
  animation.finished
    .catch(() => {})
    .finally(() => removePointPopup(pointPopups, pointPopup));
}


function updatePointPopups(pointPopups) {
  for (let index = pointPopups.length - 1; index >= 0; index -= 1) {
    if (!pointPopups[index].element.isConnected) {
      pointPopups.splice(index, 1);
    }
  }
}

function removePointPopup(pointPopups, pointPopup) {
  pointPopup.element.remove();
  const index = pointPopups.indexOf(pointPopup);

  if (index !== -1) {
    pointPopups.splice(index, 1);
  }
}

function removePrize(scene, prizePool, prize) {
  recyclePrize(scene, prizePool, prize);
}

function checkDroppedPrizes(
  scene,
  world,
  prizes,
  pointPopups,
  scoreState,
  respawnQueue,
  prizePool,
) {
  for (let index = prizes.length - 1; index >= 0; index -= 1) {
    const prize = prizes[index];

    if (!prize.isDynamic) {
      continue;
    }

    const prizeBottomY = getPrizeBottomY(prize);

    if (prizeBottomY <= prizeDropScoreHeight) {
      scoreState.points += 1;
      createPointPopup(pointPopups);
      removePrize(scene, prizePool, prize);
      prizes.splice(index, 1);
      schedulePrizeRespawn(respawnQueue, prize.slot);
    }
  }
}

function handleCollisionEvents(
  eventQueue,
  tokenColliderHandleMap,
  prizeColliderHandleMap,
) {
  eventQueue.drainCollisionEvents((handle1, handle2, started) => {
    if (!started) {
      return;
    }

    const prize = prizeColliderHandleMap.get(handle1) ?? prizeColliderHandleMap.get(handle2);
    const token = tokenColliderHandleMap.get(handle1) ?? tokenColliderHandleMap.get(handle2);

    if (prize && token) {
      activatePrizePhysics(prize, token);
    }
  });
}

function syncPrizeMeshes(prizes) {
  prizes.forEach((prize) => {
    if (!prize.isDynamic) {
      return;
    }

    const isSleeping = typeof prize.prizeBody.isSleeping === 'function'
      ? prize.prizeBody.isSleeping()
      : false;

    if (isSleeping) {
      return;
    }

    const position = prize.prizeBody.translation();
    const rotation = prize.prizeBody.rotation();

    prize.prize.position.set(position.x, position.y, position.z);
    prize.prize.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  });
}

function syncRingTraceArea() {
  const imageRect = ringImage.getBoundingClientRect();
  const traceSide = Math.min(imageRect.width, imageRect.height) * ringTraceAreaScale;

  ringTraceArea.style.width = `${traceSide}px`;
  ringTraceArea.style.height = `${traceSide}px`;
}

function setupRingUi() {
  let ringState = null;
  const syncWhenReady = () => requestAnimationFrame(() => {
    syncRingTraceArea();
    if (ringState) {
      ringState.needsRender = true;
    }
  });

  if (ringImage.complete) {
    syncWhenReady();
  } else {
    ringImage.addEventListener('load', syncWhenReady, { once: true });
  }

  window.addEventListener('resize', syncWhenReady);

  const aimDirection = new THREE.Vector2(0, 0);
  const dragStartAim = new THREE.Vector2(0, 0);
  const dragStartPointer = new THREE.Vector2(0, 0);
  const tracedPoints = [];
  ringState = {
    element: ringUi,
    image: ringImage,
    traceArea: ringTraceArea,
    aimDirection,
    aimLimits: launcherAimLimits,
    tracedPoints,
    syncTraceArea: syncWhenReady,
    needsRender: true,
  };
  const clampAimDirection = (aim) => {
    aim.x = THREE.MathUtils.clamp(aim.x, -1, 1);
    aim.y = THREE.MathUtils.clamp(aim.y, -1, 1);
  };
  const updateTracePoint = (event) => {
    const areaRect = ringTraceArea.getBoundingClientRect();
    const localX = event.clientX - areaRect.left;
    const localY = event.clientY - areaRect.top;
    const radius = Math.max(Math.min(areaRect.width, areaRect.height) / 2, 1);
    const pointerDelta = new THREE.Vector2(
      (localX - dragStartPointer.x) / radius,
      (localY - dragStartPointer.y) / radius,
    );
    const nextAim = dragStartAim.clone().add(pointerDelta);

    clampAimDirection(nextAim);
    aimDirection.copy(nextAim);
    ringState.needsRender = true;
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
    const areaRect = ringTraceArea.getBoundingClientRect();

    tracedPoints.length = 0;
    dragStartAim.copy(aimDirection);
    dragStartPointer.set(event.clientX - areaRect.left, event.clientY - areaRect.top);
    ringTraceArea.setPointerCapture(event.pointerId);
  });

  ringTraceArea.addEventListener('pointermove', (event) => {
    if (ringTraceArea.hasPointerCapture(event.pointerId)) {
      updateTracePoint(event);
    }
  });

  ringTraceArea.addEventListener('pointerup', finishAim);
  ringTraceArea.addEventListener('pointercancel', finishAim);

  return ringState;
}

function applyLauncherAim(launcher, aimDirection) {
  const yawOffset = aimDirection.x * launcherAimLimits.maxYaw;
  const pitchOffset = -aimDirection.y * launcherAimLimits.maxPitch;

  launcher.launcher.rotation.set(
    launcherViewRotation.x + pitchOffset,
    launcherViewRotation.y + yawOffset,
    launcherViewRotation.z,
  );
}

function createActionCooldown() {
  return {
    duration: actionCooldownDuration,
    remaining: 0,
    lastGaugeProgress: null,
    lastButtonDisabled: null,
  };
}

function isActionCoolingDown(cooldown) {
  return cooldown.remaining > 0;
}

function updateCooldownGauge(cooldown, { animate = true } = {}) {
  const progress = 1 - (cooldown.remaining / cooldown.duration);
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);

  if (!animate) {
    cooldownGaugeFill.style.transition = 'none';
  }

  if (cooldown.lastGaugeProgress !== clampedProgress) {
    cooldownGaugeFill.style.transform = `scaleX(${clampedProgress})`;
    cooldown.lastGaugeProgress = clampedProgress;
  }

  if (!animate) {
    // クールダウン開始時だけは、満タンから0へ戻る動きを見せずに即0へ切り替える。
    void cooldownGaugeFill.offsetWidth;
    cooldownGaugeFill.style.transition = '';
  }

  const isDisabled = isActionCoolingDown(cooldown);

  if (cooldown.lastButtonDisabled !== isDisabled) {
    actionButton.disabled = isDisabled;
    actionButton.setAttribute('aria-disabled', String(isDisabled));
    cooldown.lastButtonDisabled = isDisabled;
  }
}

function startActionCooldown(cooldown) {
  cooldown.remaining = cooldown.duration;
  updateCooldownGauge(cooldown, { animate: false });
}

function tickActionCooldown(cooldown, delta) {
  if (!isActionCoolingDown(cooldown)) {
    updateCooldownGauge(cooldown);
    return;
  }

  cooldown.remaining = Math.max(cooldown.remaining - delta, 0);
  updateCooldownGauge(cooldown);
}

async function init() {
  await RAPIER.init({});

  const scene = new THREE.Scene();

  const gravity = new RAPIER.Vector3(0, -9.81, 0);
  const world = new RAPIER.World(gravity);
  const eventQueue = new RAPIER.EventQueue(true);
  const renderer = createRenderer();
  const camera = createCamera();
  scene.add(camera);
  const background = await configureBackground(scene);
  const lights = addLights(scene);

  const ring = setupRingUi();
  const ground = await loadGround(scene, world);
  const wall = await loadWall(scene, world);
  const shelf = await loadShelf(scene, world, wall.wallBox);
  const prizeTypes = await loadPrizeTypes();
  const tokenColliderHandleMap = new Map();
  const prizeColliderHandleMap = new Map();
  const prizes = fillInitialPrizeSlots(scene, world, prizeTypes, prizeColliderHandleMap);
  const tent = await loadTent(scene, world);
  const trees = loadDecorativeTrees ? await loadTrees(scene) : [];
  frameObjectInView(wall.wall, camera);
  const table = await loadTable(camera);
  const launcher = await loadLauncher(camera);
  const tokenTemplate = await loadTokenTemplate();
  const pointTexture = await loadPointTexture();
  const popSound = createPopSound();
  const actionCooldown = createActionCooldown();
  updateCooldownGauge(actionCooldown);
  const tokens = [];
  const pointPopups = [];
  const scoreState = createScoreState();
  const prizeRespawnQueue = createPrizeRespawnQueue();
  const prizePool = createPrizePool();

  function onResize() {
    camera.aspect = getViewportAspect();
    camera.updateProjectionMatrix();
    setRendererViewport(renderer);
    ring.needsRender = true;
  }

  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  actionButton.addEventListener('click', () => {
    if (isActionCoolingDown(actionCooldown)) {
      return;
    }

    applyLauncherAim(launcher, ring.aimDirection);
    playPopSound(popSound);
    tokens.push(createToken(
      scene,
      world,
      tokenTemplate,
      launcher,
      tokenColliderHandleMap,
    ));
    startActionCooldown(actionCooldown);
  });

  let previousFrameTime = null;

  function animate(timestamp) {
    requestAnimationFrame(animate);

    if (previousFrameTime === null) {
      previousFrameTime = timestamp - targetFrameDuration;
    }

    const elapsed = timestamp - previousFrameTime;

    if (elapsed < targetFrameDuration) {
      return;
    }

    // 余った時間を次のフレームへ繰り越し、端末ごとの差が出にくい更新頻度を保つ。
    previousFrameTime = timestamp - (elapsed % targetFrameDuration);

    const delta = Math.min(elapsed / 1000, maxFrameDelta);
    const hasPhysicsWork = hasActiveTokens(tokens) || hasAwakeDynamicPrizes(prizes);
    let shouldRender = hasPendingVisualWork(tokens, prizes, ring);

    if (hasPhysicsWork) {
      world.timestep = delta;
      world.step(eventQueue);
      handleCollisionEvents(eventQueue, tokenColliderHandleMap, prizeColliderHandleMap);
      syncTokenMeshes(tokens);
      checkDroppedPrizes(
        scene,
        world,
        prizes,
        pointPopups,
        scoreState,
        prizeRespawnQueue,
        prizePool,
      );
      syncPrizeMeshes(prizes);
      pruneTokens(scene, world, tokens, delta, tokenColliderHandleMap);
      shouldRender = true;
    }

    if (prizeRespawnQueue.length > 0) {
      shouldRender = updatePrizeRespawns(
        scene,
        world,
        prizes,
        prizeTypes,
        prizeRespawnQueue,
        delta,
        prizeColliderHandleMap,
        prizePool,
      ) || shouldRender;
    }

    if (ring.needsRender) {
      applyLauncherAim(launcher, ring.aimDirection);
    }

    if (isActionCoolingDown(actionCooldown)) {
      tickActionCooldown(actionCooldown, delta);
    }

    if (pointPopups.length > 0) {
      updatePointPopups(pointPopups);
    }

    if (shouldRender) {
      renderer.render(scene, camera);
      ring.needsRender = false;
    }

  }

  requestAnimationFrame(animate);

  // 今後の体験コンテンツ初期化で使えるように、最小構成を公開しておく。
  window.boothRuntime = {
    THREE,
    RAPIER,
    scene,
    world,
    eventQueue,
    renderer,
    camera,
    lights,
    background,
    ground,
    wall,
    shelf,
    prizes,
    prizeTypes,
    prizeTypeConfigs,
    prizeSizeByTypeId,
    prizeSlotConfigs,
    prizeRespawnQueue,
    tent,
    trees,
    treeConfigs,
    table,
    launcher,
    tokenTemplate,
    pointTexture,
    pointPopups,
    scoreState,
    popSound,
    actionCooldown,
    tokens,
    tokenColliderHandleMap,
    prizeColliderHandleMap,
    ring,
    aimLimits: launcherAimLimits,
  };
}

init().catch((error) => {
  console.error(error);
});
