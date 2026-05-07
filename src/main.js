import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

const status = document.querySelector('#status');

async function init() {
  await RAPIER.init();

  const scene = new THREE.Scene();
  const gravity = new RAPIER.Vector3(0, -9.81, 0);
  const world = new RAPIER.World(gravity);

  status.textContent = `three.js r${THREE.REVISION} と Rapier Physics を読み込みました。`;

  // 今後のゲーム初期化で使えるように、最小構成を公開しておく。
  window.gameRuntime = {
    THREE,
    RAPIER,
    scene,
    world,
  };
}

init().catch((error) => {
  console.error(error);
  status.textContent = 'ライブラリの読み込みに失敗しました。';
});
