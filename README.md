# Shooting_game

ブラウザで動かすシューティングゲームのプロジェクトです。

## 起動方法

ローカルサーバーを立ち上げて `index.html` を開きます。

```bash
python3 -m http.server 8000
```

その後、ブラウザで <http://localhost:8000/> にアクセスしてください。


## 景品サイズの設定

`src/main.js` の `prizeSizeByTypeId` で、`Prize/Prize_1.glb` 〜 `Prize/Prize_10.glb` の景品タイプごとの表示サイズを設定できます。数値を指定するとモデルの最大辺がそのサイズにそろい、`new THREE.Vector3(幅, 高さ, 奥行き)` を指定すると軸ごとのサイズを個別に設定できます。

`Prize_4.glb`、`Prize_5.glb`、`Prize_8.glb` の高さだけを調整したい場合は、`src/main.js` の `prizeHeightScaleByTypeId` で倍率を変更してください。例えば `4: 1.2` にすると `Prize_4.glb` の高さだけが 1.2 倍になります。

同じ景品タイプでも配置場所ごとに大きさを変えたい場合は、`prizeSlotConfigs` の `sizeScale` を変更してください。

## ライブラリ

- three.js は import map で CDN から読み込みます。
- Rapier Physics (`@dimforge/rapier3d-compat`) は import map で CDN から読み込み、`RAPIER.init({})` で初期化します。

## ライセンス表記

サードパーティライブラリのライセンス表記は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にまとめています。
