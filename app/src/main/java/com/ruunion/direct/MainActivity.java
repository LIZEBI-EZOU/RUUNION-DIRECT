package com.ruunion.direct;
import android.Manifest;import android.app.*;import android.content.*;import android.content.pm.PackageManager;import android.net.Uri;import android.os.*;import android.provider.Settings;import android.webkit.*;import java.util.*;
public class MainActivity extends Activity {
 private WebView webView; private static final int MEDIA_PERMISSION_REQUEST=42, NOTIFICATION_PERMISSION_REQUEST=43;
 @Override public void onCreate(Bundle state){super.onCreate(state);webView=new WebView(this);WebSettings s=webView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);s.setMediaPlaybackRequiresUserGesture(false);s.setAllowFileAccess(false);s.setAllowContentAccess(false);if(Build.VERSION.SDK_INT>=26)s.setSafeBrowsingEnabled(true);if(Build.VERSION.SDK_INT>=21)s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  webView.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("file".equals(u.getScheme())||"https".equals(u.getScheme()))return false;try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}});
  webView.setWebChromeClient(new WebChromeClient(){@Override public void onPermissionRequest(final PermissionRequest r){runOnUiThread(()->{List<String>a=new ArrayList<>();for(String x:r.getResources())if(PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x)||PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x))a.add(x);if(!a.isEmpty())r.grant(a.toArray(new String[0]));else r.deny();});}});
  webView.addJavascriptInterface(new AndroidBridge(this),"AndroidBridge");setContentView(webView);
  if(Build.VERSION.SDK_INT>=23)requestPermissions(new String[]{Manifest.permission.CAMERA,Manifest.permission.RECORD_AUDIO},MEDIA_PERMISSION_REQUEST);
  if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);
  webView.loadUrl("file:///android_asset/index.html");
 }
 public void openAppSettings(){try{startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName())));}catch(Exception ignored){}}
 @Override public void onBackPressed(){if(webView!=null&&webView.canGoBack())webView.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(webView!=null)webView.destroy();super.onDestroy();}
 public static class AndroidBridge{
  private final Context context; AndroidBridge(Context c){context=c.getApplicationContext();}
  @JavascriptInterface public void scheduleNotification(String id,String title,String code,long whenMs){Intent i=new Intent(context,MeetingNotificationReceiver.class);i.putExtra("title",title);i.putExtra("code",code);int rc=Math.abs(id.hashCode());PendingIntent pi=PendingIntent.getBroadcast(context,rc,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(am==null)return;if(Build.VERSION.SDK_INT>=31&&!am.canScheduleExactAlarms())whenMs=Math.max(whenMs,System.currentTimeMillis()+60000);if(Build.VERSION.SDK_INT>=23)am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,whenMs,pi);else am.set(AlarmManager.RTC_WAKEUP,whenMs,pi);}
  @JavascriptInterface public void cancelNotification(String id){Intent i=new Intent(context,MeetingNotificationReceiver.class);PendingIntent pi=PendingIntent.getBroadcast(context,Math.abs(id.hashCode()),i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);AlarmManager am=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);if(am!=null)am.cancel(pi);pi.cancel();}
  @JavascriptInterface public boolean isAndroidApp(){return true;} @JavascriptInterface public void openSettings(){if(context instanceof MainActivity)((MainActivity)context).openAppSettings();}
 }
}