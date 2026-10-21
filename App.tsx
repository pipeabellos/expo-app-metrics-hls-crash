import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import HlsDownload from './modules/hls-download/src/HlsDownloadModule';

// Apple's public HLS sample. Any HLS URL reproduces the crash: the app aborts
// inside AVAssetDownloadTask.resume(), before the original resume() runs.
const STREAM = 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8';

export default function App() {
  const [status, setStatus] = useState('idle');
  const start = async () => {
    setStatus('resuming');
    setStatus(await HlsDownload.start(STREAM));
  };
  return (
    <View style={styles.container}>
      <Text>expo-observe + AVAssetDownloadTask</Text>
      <Text testID="status">{status}</Text>
      <Button title="Start HLS download" onPress={start} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 12 },
});
