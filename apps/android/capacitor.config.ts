import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cyberuniverse.app',
  appName: 'Cyber Universe',
  webDir: '../web/dist',
  server: {
    // 开发期直连本机后端；生产构建删除此字段使用打包资源
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
