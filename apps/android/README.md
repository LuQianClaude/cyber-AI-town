# Cyber Universe Android

Capacitor 外壳，包裹 `apps/web` 的构建产物。

## 前置要求

- Android Studio + Android SDK（API 34+）
- JDK 17

## 同步与运行

```bash
# 根目录
pnpm --filter @cyber-universe/web build
pnpm android:sync
cd apps/android
npx cap open android   # 在 Android Studio 中运行 / 打包 APK
```

## 安全存储

用户令牌等敏感数据在 M5 通过 `@capacitor/preferences` + Android Keystore 封装，
禁止明文存入 WebView localStorage。
