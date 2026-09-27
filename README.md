# RUUNION DIRECT

Application de réunions vidéo accessible depuis le navigateur et Android.

- Interface bleu et blanc
- Réunions instantanées
- Code de réunion partageable
- Programmation locale
- Vidéo et audio via Jitsi Meet
- Workflow GitHub Actions pour construire l'APK debug

Le même code de réunion ouvre la même salle Jitsi depuis le navigateur ou l'application.

## Construction

Le workflow `.github/workflows/android.yml` construit `app-debug.apk` et le publie comme artefact GitHub Actions.
