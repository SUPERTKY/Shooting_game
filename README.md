# School Fair Prize Booth

ブラウザで動かす、学校発表向けの縁日風3D景品体験です。

## 起動方法

ローカルサーバーを立ち上げて `index.html` を開きます。

```bash
python3 -m http.server 8000
```

その後、ブラウザで <http://localhost:8000/> にアクセスしてください。



## 景品サイズの設定

標準設定では、GPU負荷を抑えるため景品を6枠、軽量な景品モデル3種類に絞っています。景品の種類を変更する場合は、`src/main.js` の `enabledPrizeTypeIds` に使いたい景品番号を指定してください。景品の表示枠数は `maxPrizeCount` で調整できます。

`src/main.js` の `prizeSizeByTypeId` で、`Prize/Prize_1.glb` 〜 `Prize/Prize_10.glb` の景品タイプごとの表示サイズを設定できます。数値を指定するとモデルの最大辺がそのサイズにそろい、`new THREE.Vector3(幅, 高さ, 奥行き)` を指定すると軸ごとのサイズを個別に設定できます。

`Prize_1.glb` 〜 `Prize_10.glb` の表示位置の高さを調整したい場合は、`src/main.js` の `prizeHeightOffsetByTypeId` で各番号の移動量を変更してください。例えば `7: 0.3` にすると `Prize_7.glb` が 0.3 上がり、`8: -0.3` にすると `Prize_8.glb` が 0.3 下がります。

同じ景品タイプでも配置場所ごとに大きさを変えたい場合は、`prizeSlotConfigs` の `sizeScale` を変更してください。

## 動作負荷について

低性能な学校PCでも動かしやすいように、標準設定では景品を6枠、軽量な景品モデルを3種類に絞っています。高ポリゴンの地面モデルは単純な平面に置き換え、装飾用の木と補助ポイントライトは無効にしています。描画解像度は負荷を抑えつつ輪郭がぼやけすぎない値に調整し、テクスチャ品質も少し戻しています。描画と物理更新は最大24fpsに制限し、動きがない場面では必要なときだけ3D画面を再描画します。

## ライブラリ

- three.js は import map で cdnjs から読み込みます。
- three.js のアドオンと Rapier Physics (`@dimforge/rapier3d-compat`) は import map で jsDelivr から読み込み、`RAPIER.init({})` で初期化します。

## ライセンス表記

サードパーティライブラリのライセンス表記は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にまとめています。


## 学校PC・フィルタ対策メモ

学校のフィルタで誤判定されにくいように、ページタイトルや公開されるアセット名は強い印象を与える表現を避け、縁日風の景品体験として表示しています。公開先のフォルダー名やURLにも同様の表現を入れないことをおすすめします。

「Iフィルターに接続の安定性を確認できない」と表示される場合は、外部 CDN の一部が学校ネットワークで判定されている可能性があります。このため、three.js 本体は jsDelivr ではなく cdnjs から読み込む設定にしています。
