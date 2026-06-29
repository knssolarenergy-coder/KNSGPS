# EAS Build History

## Android APK — Preview Profile

| Field | Value |
|-------|-------|
| Build ID | `431f8af5-a7c2-413b-a73b-d5362692c355` |
| Platform | Android |
| Profile | preview |
| Distribution | internal (APK) |
| SDK Version | 54.0.0 |
| App Version | 1.0.0 |
| Status | in queue (builds take ~10-20 min on EAS servers) |
| Started | 2026-06-15 12:09 UTC |
| Build URL | https://expo.dev/accounts/yousaf43/projects/ks-solar/builds/431f8af5-a7c2-413b-a73b-d5362692c355 |

### How to trigger future builds

```bash
# From artifacts/ks-solar — EAS_NO_VCS=1 is required in the Replit environment
# (EAS CLI uses git-add internally; Replit blocks that — EAS_NO_VCS=1 bypasses it)
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --profile preview --platform android --non-interactive
```

The command will time out locally after upload (~2 min) — that is expected.
The APK download link appears on the build page once complete.
