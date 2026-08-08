const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('⚙️ Switching workspace config to ADMIN APP (com.star7.admin)...');

// 1. Copy capacitor.admin.json for Admin App into capacitor.config.json
const adminCapConfig = {
  appId: "com.star7.admin",
  appName: "7 STAR ADMIN",
  webDir: "public",
  server: {
    url: "https://7starinvest.vercel.app/xpro-admin/login.html",
    cleartext: true
  }
};
fs.writeFileSync(
  path.join(__dirname, '../capacitor.config.json'),
  JSON.stringify(adminCapConfig, null, 2)
);

// 2. Update Android build.gradle applicationId
const gradlePath = path.join(__dirname, '../android/app/build.gradle');
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/applicationId\s+["'].*?["']/, 'applicationId "com.star7.admin"');
  fs.writeFileSync(gradlePath, content);
}

// 3. Update Android strings.xml app_name and package_name
const stringsPath = path.join(__dirname, '../android/app/src/main/res/values/strings.xml');
if (fs.existsSync(stringsPath)) {
  let content = fs.readFileSync(stringsPath, 'utf8');
  content = content.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">7 STAR ADMIN</string>');
  content = content.replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">7 STAR ADMIN</string>');
  content = content.replace(/<string name="package_name">.*?<\/string>/, '<string name="package_name">com.star7.admin</string>');
  content = content.replace(/<string name="custom_url_scheme">.*?<\/string>/, '<string name="custom_url_scheme">com.star7.admin</string>');
  fs.writeFileSync(stringsPath, content);
}

console.log('🔄 Running npx cap sync android for Admin App...');
execSync('npx cap sync android', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
console.log('✅ Admin App (com.star7.admin) prepared successfully!');
