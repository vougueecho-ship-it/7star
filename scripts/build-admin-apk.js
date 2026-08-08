const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');

console.log('👑 Configuring for 7 STAR ADMIN (Admin App)...');

// 1. capacitor.config.json
const capConfig = {
  appId: "com.star7.admin",
  appName: "7 STAR ADMIN",
  webDir: "public",
  server: {
    url: "https://7starinvest.vercel.app/xpro-admin/login.html",
    cleartext: true
  }
};
fs.writeFileSync(
  path.join(rootDir, 'capacitor.config.json'),
  JSON.stringify(capConfig, null, 2)
);

// 2. build.gradle applicationId
const buildGradlePath = path.join(rootDir, 'android/app/build.gradle');
let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle.replace(/applicationId "com\.star7\.(admin|invest)"/g, 'applicationId "com.star7.admin"');
fs.writeFileSync(buildGradlePath, buildGradle);

// 3. strings.xml
const stringsPath = path.join(rootDir, 'android/app/src/main/res/values/strings.xml');
const stringsXml = `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">7 STAR ADMIN</string>
    <string name="title_activity_main">7 STAR ADMIN</string>
    <string name="package_name">com.star7.admin</string>
    <string name="custom_url_scheme">com.star7.admin</string>
</resources>
`;
fs.writeFileSync(stringsPath, stringsXml);

console.log('🔄 Running npx cap sync...');
execSync('npx cap sync', { cwd: rootDir, stdio: 'inherit' });

console.log('⚙️ Building 7 STAR ADMIN Release APK...');
const env = { ...process.env, JAVA_HOME: "/Applications/Android Studio.app/Contents/jbr/Contents/Home" };
execSync('./gradlew assembleRelease', { cwd: path.join(rootDir, 'android'), env, stdio: 'inherit' });

const outputApk = path.join(rootDir, 'android/app/build/outputs/apk/release/app-release.apk');
const targetApk = path.join(rootDir, 'public/7star-admin.apk');

if (fs.existsSync(outputApk)) {
  fs.copyFileSync(outputApk, targetApk);
  const stats = fs.statSync(targetApk);
  console.log(`✅ SUCCESS! Admin APK created at public/7star-admin.apk (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} else {
  console.error('❌ Build failed: output APK not found.');
}
