# expo-app-metrics: resuming an AVAssetDownloadTask aborts the app (iOS)

Minimal reproduction for an iOS crash in `expo-app-metrics` 58.0.13, which `expo-observe` 58.0.15 installs. Both are the latest versions on npm as of 2026-10-20, and the code involved is the same on `main`.

## What it does

A blank Expo SDK 58 app (`npx create-expo-app --template blank-typescript`) with two additions:

- `expo-observe` in `package.json`. The app never imports it and never calls `Observe.configure`, so network traces stay at their default (off).
- A local Expo module, `modules/hls-download` (iOS only, one Swift file). `HlsDownload.start(url)` creates an `AVAssetDownloadURLSession` with a background configuration, makes an `AVAssetDownloadTask` for an HLS `AVURLAsset` and calls `resume()` on the main queue, the way an offline video download manager does. It resolves with the task state after `resume()`.

`App.tsx` shows one button, "Start HLS download", which calls `HlsDownload.start` with Apple's public HLS sample stream and prints the result.

## Steps

You need macOS, Xcode, CocoaPods and an iOS simulator.

1. `npm install`
2. `npx expo prebuild -p ios`
3. Build the Release configuration and run it on an iOS simulator, for example with `npx expo run:ios --configuration Release`. We built it with Xcode's command line tools:

   ```sh
   xcodebuild -workspace ios/expoappmetricshlscrash.xcworkspace -scheme expoappmetricshlscrash \
     -configuration Release -sdk iphonesimulator -destination 'id=<SIMULATOR_UDID>' \
     -derivedDataPath ios/build build
   xcrun simctl install <SIMULATOR_UDID> ios/build/Build/Products/Release-iphonesimulator/expoappmetricshlscrash.app
   xcrun simctl launch <SIMULATOR_UDID> dev.repro.appmetricshlscrash
   ```

4. Tap "Start HLS download".

## Expected

No crash. The status line changes to "download running" and the HLS download completes (about 15 seconds on a simulator).

## Actual

The app aborts inside `resume()`:

```text
*** Terminating app due to uncaught exception 'NSGenericException', reason: 'AVAssetDownloadTask does not support originalRequest property'
```

Crashing thread (Release build, iPhone 17 Pro simulator, iOS 26.5):

```text
9   libobjc.A.dylib          objc_exception_throw + 384
10  CFNetwork                -[__NSCFBackgroundAVAssetDownloadTask originalRequest] + 48
11  expoappmetricshlscrash   specialized static NetworkRequestTaskSwizzling.observeStart(_:) + 564 (NetworkRequestTaskSwizzling.swift:218)
12  expoappmetricshlscrash   static NetworkRequestTaskSwizzling.observeStart(_:) + 4
13  expoappmetricshlscrash   closure #1 in static NetworkRequestTaskSwizzling.installResumeSwizzle() + 32 (NetworkRequestTaskSwizzling.swift:184)
14  expoappmetricshlscrash   0x104f14000 + 87576
15  expoappmetricshlscrash   closure #1 in closure #1 in HlsDownloadModule.definition() + 8 (HlsDownloadModule.swift:27)
```

Frame 15 is the `task.resume()` call.

If `resume()` runs synchronously inside a call from JS instead, JSI catches the Objective-C exception and the app dies with `RCTFatalException: Unhandled JS Exception: Error: Exception in HostFunction: <unknown>`. That is why the module resumes the task on the main queue.

## Control: without expo-observe

```sh
npm uninstall expo-observe
npx expo prebuild -p ios --clean
```

Build, install and launch again (step 3), then tap the button. No crash: the status line reads "download running", and `nsurlsessiond` logs `AVAssetDownloadSession did complete with error (null)` when the download finishes.

## Cause

At app delegate start, `expo-app-metrics` swizzles `resume` on `URLSessionTask`, before any JS runs. The hook, `NetworkRequestTaskSwizzling.observeStart(_:)`, reads `task.originalRequest` for every task it sees (`ios/NetworkRequests/NetworkRequestTaskSwizzling.swift`, line 218). AVFoundation marks `originalRequest` as `NS_UNAVAILABLE` on `AVAssetDownloadTask`, and the getter raises `NSGenericException`. Returning early from `observeStart` unless `task is URLSessionDataTask || task is URLSessionDownloadTask` (upload tasks are data tasks) fixes it.
