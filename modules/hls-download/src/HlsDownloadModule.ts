import { NativeModule, requireNativeModule } from 'expo';

declare class HlsDownloadModule extends NativeModule<{}> {
  // Resolves with the task state after `resume()`. With expo-observe installed
  // it never resolves: the app aborts inside `resume()`.
  start(url: string): Promise<string>;
}

export default requireNativeModule<HlsDownloadModule>('HlsDownload');
