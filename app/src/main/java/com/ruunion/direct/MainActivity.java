package com.ruunion.direct;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import java.io.*;
import java.util.*;

public class MainActivity extends Activity {
 private WebView webView;
 private static final int MEDIA_PERMISSION_REQUEST=42,NOTIFICATION_PERMISSION_REQUEST=43;
 private static final String JAAS_API_FALLBACK="https://8x8.vc/external_api.js";

 @Override public void onCreate(Bundle state){
  super.onCreate(state);
  webView=new WebView(this);
  android.webkit.CookieManager.getInstance().setAcceptCookie(true);
  if(Build.VERSION.SDK_INT>=21)android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView,true);
  WebSettings s=webView.getSettings();
  s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);
  s.setMediaPlaybackRequiresUserGesture(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);
  s.setJavaScriptCanOpenWindowsAutomatically(true);s.setSupportMultipleWindows(false);
  s.setCacheMode(WebSettings.LOAD_DEFAULT);
  if(Build.VERSION.SDK_INT>=26)s.setSafeBrowsingEnabled(true);
  if(Build.VERSION.SDK_INT>=21)s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  webView.setWebViewClient(new WebViewClient(){
   private void ensureJaasExternalApi(WebView v){
    String js="(function(){if(typeof window.JitsiMeetExternalAPI==='function'){return;}var s=document.getElementById('ruunion-jaas-api-fallback');if(s)return;s=document.createElement('script');s.id='ruunion-jaas-api-fallback';s.src='"+JAAS_API_FALLBACK+"';s.async=true;document.head.appendChild(s);})();";
    v.evaluateJavascript(js,null);
   }
   @Override public void onPageFinished(WebView v,String url){
    super.onPageFinished(v,url);
    ensureJaasExternalApi(v);
    v.postDelayed(()->ensureJaasExternalApi(v),1200);
    v.postDelayed(()->ensureJaasExternalApi(v),3000);
   }
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();
    if("https".equalsIgnoreCase(u.getScheme())&&"ruunion.local".equalsIgnoreCase(u.getHost())){
     String path=u.getPath();
     if("/ruunion-logo.png".equals(path)){
      try{return new WebResourceResponse("image/png","UTF-8",getAssets().open("ruunion-logo.png"));}catch(Exception ignored){}
     }
    }
    return super.shouldInterceptRequest(v,r);
   }
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
    Uri u=r.getUrl();String scheme=u.getScheme();
    if("file".equals(scheme)||"https".equals(scheme))return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
    return true;
   }
   @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){
    if(r!=null&&r.getUrl()!=null&&r.getUrl().toString().contains("external_api.js")){ensureJaasExternalApi(v);return;}
    if(r.isForMainFrame()&&Build.VERSION.SDK_INT>=23){
     v.loadDataWithBaseURL(null,"<html><body style='font-family:sans-serif;padding:24px'><h2>RÉUNION DIRECT</h2><p>Connexion Internet indisponible. Vérifiez votre réseau puis relancez l'application.</p></body></html>","text/html","UTF-8",null);
    }
   }
   @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e){
    super.onReceivedHttpError(v,r,e);
    if(r!=null&&r.getUrl()!=null&&r.getUrl().toString().contains("external_api.js"))ensureJaasExternalApi(v);
   }
  });
  webView.setWebChromeClient(new WebChromeClient(){
   @Override public void onPermissionRequest(final PermissionRequest r){
    runOnUiThread(()->{
     Uri origin=r.getOrigin();
     if(origin==null||!"https".equalsIgnoreCase(origin.getScheme())||!"8x8.vc".equalsIgnoreCase(origin.getHost())){r.deny();return;}
     List<String>a=new ArrayList<>();
     for(String x:r.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x)||PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x))a.add(x);
     if(!a.isEmpty())r.grant(a.toArray(new String[0]));else r.deny();
    });
   }
   @Override public boolean onConsoleMessage(ConsoleMessage m){
    return super.onConsoleMessage(m);
   }
  });
  webView.addJavascriptInterface(new AndroidBridge(this),"AndroidBridge");
  setContentView(webView);
  requestMediaPermissions();
  try{
   InputStream in=getAssets().open("index.html");ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buf=new byte[8192];int n;
   while((n=in.read(buf))!=-1)out.write(buf,0,n);in.close();
   webView.loadDataWithBaseURL("https://ruunion.local/",new String(out.toByteArray(),"UTF-8"),"text/html","UTF-8","https://ruunion.local/");
  }catch(Exception e){webView.loadDataWithBaseURL("https://ruunion.local/","<h2>RÉUNION DIRECT</h2><p>Impossible de charger l'application.</p>","text/html","UTF-8",null);}
 }

 private void requestMediaPermissions(){
  if(Build.VERSION.SDK_INT>=23){
   ArrayList<String> p=new ArrayList<>();
   if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)p.add(Manifest.permission.CAMERA);
   if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED)p.add(Manifest.permission.RECORD_AUDIO);
   if(!p.isEmpty()){requestPermissions(p.toArray(new String[0]),MEDIA_PERMISSION_REQUEST);return;}
  }
  requestNotificationPermission();
 }
 private void requestNotificationPermission(){
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
   requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);
 }
 @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
  super.onRequestPermissionsResult(requestCode,permissions,grantResults);
  if(requestCode==MEDIA_PERMISSION_REQUEST)requestNotificationPermission();
 }

 public void openAppSettings(){
  try{startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));}catch(Exception ignored){}
 }
 public void openMeetingInBrowser(String url){
  try{Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse(url));startActivity(i);}catch(Exception ignored){}
 }
 @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(webView!=null)webView.destroy();super.onDestroy();}

 public static class AndroidBridge{
  private final Context context;AndroidBridge(Context c){context=c.getApplicationContext();}
  @JavascriptInterface public void scheduleNotification(String id,String title,String code,long whenMs,String body,String location){
   Intent i=new Intent(context,MeetingNotificationReceiver.class);i.putExtra("title",title);i.putExtra("code",code);i.putExtra("body",body);i.putExtra("location",location);
   int rc=Math.abs(id.hashCode());PendingIntent pi=PendingIntent.getBroadcast(context,rc,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(am==null)return;
   if(Build.VERSION.SDK_INT>=31&&!am.canScheduleExactAlarms())whenMs=Math.max(whenMs,System.currentTimeMillis()+60000);
   if(Build.VERSION.SDK_INT>=23)am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,whenMs,pi);else am.set(AlarmManager.RTC_WAKEUP,whenMs,pi);
  }
  @JavascriptInterface public void cancelNotification(String id){
   Intent i=new Intent(context,MeetingNotificationReceiver.class);
   PendingIntent pi=PendingIntent.getBroadcast(context,Math.abs(id.hashCode()),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(am!=null)am.cancel(pi);pi.cancel();
  }
  @JavascriptInterface public boolean isAndroidApp(){return true;}
  @JavascriptInterface public void openSettings(){if(context instanceof MainActivity)((MainActivity)context).openAppSettings();}
  @JavascriptInterface public void openMeetingInBrowser(String url){if(context instanceof MainActivity)((MainActivity)context).openMeetingInBrowser(url);}
 }
}