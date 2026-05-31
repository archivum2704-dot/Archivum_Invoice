import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { useRef, useState } from 'react'

const APP_URL = 'https://invoice-saa-s-espa-a.vercel.app'

export default function App() {
  const webViewRef = useRef<WebView>(null)
  const [loading, setLoading] = useState(true)

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#0f172a" />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: APP_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        userAgent={
          Platform.OS === 'ios'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 DocVault/1.0'
            : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 DocVault/1.0'
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
})
