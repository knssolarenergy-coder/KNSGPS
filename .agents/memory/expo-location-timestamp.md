---
name: Expo Location timestamp field
description: LocationObject.timestamp is on the root object, NOT on coords — coords.timestamp is undefined and causes silent crash in background task
---

The Expo `LocationObject` type is:
```
{ coords: { latitude, longitude, ... }, timestamp: number }
```

`timestamp` is on the **root** `LocationObject`, not on `coords`. Writing `loc.coords.timestamp` returns `undefined`. Then `new Date(undefined).toISOString()` throws `RangeError: Invalid time value`. If this is inside the background task's try-catch, the error is swallowed silently and `postLocationResilient` is never called — tracking appears completely dead.

**Why:** This bit us when adding the offline queue (needed recordedAt timestamp). Used `loc.coords.timestamp` instead of `loc.timestamp`.

**How to apply:** Always use `loc.timestamp` (not `loc.coords.timestamp`) when reading the GPS fix timestamp from Expo Location background task data.
