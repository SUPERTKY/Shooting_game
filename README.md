# Shooting_game

ブラウザで動かすシューティングゲームのプロジェクトです。

## 起動方法

ローカルサーバーを立ち上げて `index.html` を開きます。

```bash
python3 -m http.server 8000
```

その後、ブラウザで <http://localhost:8000/> にアクセスしてください。

## ライブラリ

- three.js は import map で CDN から読み込みます。
- Rapier Physics (`@dimforge/rapier3d-compat`) は import map で CDN から読み込み、`RAPIER.init({})` で初期化します。

## ライセンス表記

サードパーティライブラリのライセンス表記は [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) にまとめています。
