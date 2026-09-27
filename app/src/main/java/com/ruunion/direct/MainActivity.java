package com.ruunion.direct;
import android.Manifest;import android.app.Activity;import android.os.Bundle;import android.webkit.*;
public class MainActivity extends Activity{
 WebView w;
 public void onCreate(Bundle b){super.onCreate(b);w=new WebView(this);WebSettings s=w.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setMediaPlaybackRequiresUserGesture(false);w.setWebViewClient(new WebViewClient());w.setWebChromeClient(new WebChromeClient(){public void onPermissionRequest(final PermissionRequest r){runOnUiThread(()->r.grant(r.getResources()));}});setContentView(w);if(android.os.Build.VERSION.SDK_INT>=23)requestPermissions(new String[]{Manifest.permission.CAMERA,Manifest.permission.RECORD_AUDIO},42);w.loadUrl("file:///android_asset/index.html");}
 public void onBackPressed(){if(w.canGoBack())w.goBack();else super.onBackPressed();}
}