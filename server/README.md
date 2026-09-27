# RUUNION DIRECT Daily API

Service serveur minimal pour RUUNION DIRECT.

Variables d'environnement :
- DAILY_API_KEY : clé secrète Daily
- DAILY_DOMAIN : ezouservicesmeeting.daily.co
- ALLOWED_ORIGINS : origine(s) autorisée(s), séparées par des virgules (ou *)

Endpoints :
- GET /health
- POST /meeting

La clé Daily reste exclusivement côté serveur. Ne jamais la mettre dans l'APK ou dans index.html.
