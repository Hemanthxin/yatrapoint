package com.saafera.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The bundled offline screen (www/offline.html) is not given Capacitor's bridge, so it reads the
        // saved-trip copy through this small read-only interface instead.
        getBridge().getWebView().addJavascriptInterface(new OfflineData(this), "SaaferaNative");
    }

    /** Read-only access to the three values the website mirrors into app storage (see NativeBridge.tsx). */
    static class OfflineData {

        private final Context context;

        OfflineData(Context context) {
            this.context = context.getApplicationContext();
        }

        @JavascriptInterface
        public String get(String key) {
            if (!"saafera.savedTrips".equals(key) && !"saafera.tripCart".equals(key) && !"saafera.syncedAt".equals(key)) {
                return null;
            }
            // Capacitor's Preferences plugin keeps its values in this file
            SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            return prefs.getString(key, null);
        }
    }
}
