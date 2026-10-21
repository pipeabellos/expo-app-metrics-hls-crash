import AVFoundation
import ExpoModulesCore

// Starts one HLS download the way any offline-video feature does. With
// expo-observe installed, `task.resume()` aborts the app: expo-app-metrics'
// URLSessionTask `resume` swizzle reads `originalRequest`, and
// AVAssetDownloadTask raises an Objective-C exception from it
// ("AVAssetDownloadTask does not support originalRequest property").
public class HlsDownloadModule: Module {
  private var session: AVAssetDownloadURLSession?

  public func definition() -> ModuleDefinition {
    Name("HlsDownload")

    AsyncFunction("start") { (url: String, promise: Promise) in
      let configuration = URLSessionConfiguration.background(withIdentifier: "repro.hls-download")
      let session = AVAssetDownloadURLSession(
        configuration: configuration, assetDownloadDelegate: nil, delegateQueue: .main)
      self.session = session
      let asset = AVURLAsset(url: URL(string: url)!)
      let task = session.makeAssetDownloadTask(
        downloadConfiguration: AVAssetDownloadConfiguration(asset: asset, title: "repro"))
      // Resume from plain native code, the way a download manager does. Called
      // synchronously inside a JS call instead, the exception is caught by JSI and
      // resurfaces as "Unhandled JS Exception: Exception in HostFunction: <unknown>".
      DispatchQueue.main.async {
        task.resume()
        // Only reached without expo-observe.
        promise.resolve(task.state == .running ? "download running" : "download state \(task.state.rawValue)")
      }
    }
  }
}
