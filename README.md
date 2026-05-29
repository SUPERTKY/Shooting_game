# Shooting_game

ブラウザで動かすシューティングゲームのプロジェクトです。

## 起動方法

ローカルサーバーを立ち上げて `index.html` を開きます。

```bash
python3 -m http.server 8000
```

その後、ブラウザで <http://localhost:8000/> にアクセスしてください。


## 画面共有の受信方法

送信側はトップページの「画面共有を開始」ボタンから共有を開始します。受信側は `viewer.html` を開き、同じ `sessionId`（初期値は `booth-01`）を入力して接続します。

```text
http://localhost:8000/viewer.html
```

受信側の Firebase 設定は `src/firebaseConfig.js` を参照しているため、送信側と受信側で同じプロジェクトに接続されます。別プロジェクトを使う場合は、このファイルを変更してください。


## 景品サイズの設定

`src/main.js` の `prizeSizeByTypeId` で、`Prize/Prize_1.glb` 〜 `Prize/Prize_10.glb` の景品タイプごとの表示サイズを設定できます。数値を指定するとモデルの最大辺がそのサイズにそろい、`new THREE.Vector3(幅, 高さ, 奥行き)` を指定すると軸ごとのサイズを個別に設定できます。

`Prize_1.glb` 〜 `Prize_10.glb` の表示位置の高さを調整したい場合は、`src/main.js` の `prizeHeightOffsetByTypeId` で各番号の移動量を変更してください。例えば `7: 0.3` にすると `Prize_7.glb` が 0.3 上がり、`8: -0.3` にすると `Prize_8.glb` が 0.3 下がります。

同じ景品タイプでも配置場所ごとに大きさを変えたい場合は、`prizeSlotConfigs` の `sizeScale` を変更してください。

## ライブラリ

- three.js は import map で CDN から読み込みます。
- Rapier Physics (`@dimforge/rapier3d-compat`) は import map で CDN から読み込み、`RAPIER.init({})` で初期化します。

## ライセンス表記

サードパーティライブラリのライセンス表記は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にまとめています。
