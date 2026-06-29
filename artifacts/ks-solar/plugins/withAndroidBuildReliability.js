const { withGradleProperties } = require("expo/config-plugins");

/**
 * Hardens the Android Gradle build for reliable EAS builds:
 * - Forces newArchEnabled=true. react-native-reanimated v4 (+ worklets) has
 *   dropped the old architecture entirely: its assertNewArchitectureEnabledTask
 *   fails the Gradle build deterministically unless the New Architecture is on.
 *   New Arch is also the Expo SDK 54 default, so this is the supported path.
 *   Set here (not just in app.json) so the gradle property is guaranteed
 *   regardless of config-merge ordering.
 * - Limits ABIs to real-device ARM architectures (drops x86/x86_64 emulator
 *   targets), roughly halving native C++ compilation (reanimated/worklets) and
 *   the peak memory it needs. This is the #1 cause of intermittent
 *   "Gradle build failed with unknown error" (out-of-memory) on EAS workers.
 * - Raises the Gradle JVM heap so Kotlin/C++ compilation does not OOM.
 *
 * Safe: ARM-only APKs run on all real Android phones; the extra heap fits
 * within EAS Android worker memory.
 */
function setProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === "property" && item.key === key,
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: "property", key, value });
  }
}

module.exports = function withAndroidBuildReliability(config) {
  return withGradleProperties(config, (cfg) => {
    setProperty(cfg.modResults, "newArchEnabled", "true");
    setProperty(cfg.modResults, "reactNativeArchitectures", "armeabi-v7a,arm64-v8a");
    setProperty(
      cfg.modResults,
      "org.gradle.jvmargs",
      "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8",
    );
    return cfg;
  });
};
