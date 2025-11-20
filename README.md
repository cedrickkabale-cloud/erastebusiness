# Application web de gestion des ventes – Ets Eraste Business SARL

Scaffold minimal - frontend React (Vite) + backend Express + SQLite.

Prerequis:
- Node.js 18+ installé

Démarrage (dans PowerShell, depuis le dossier du projet `d:/Projet Web/erastebusiness`):

```powershell
# Backend
cd "d:/Projet Web/erastebusiness/backend"
npm install
npm run dev

# Dans un autre terminal -> Frontend
cd "d:/Projet Web/erastebusiness/frontend"
npm install
npm run dev
```

Le backend écoute par défaut sur `http://localhost:4000`.
Le frontend (Vite) s'ouvrira sur `http://localhost:5173`.

Configuration d'environnement
 - Copiez `backend/.env.example` en `backend/.env` et mettez à jour `JWT_SECRET` et `FRONTEND_ORIGIN` avant de déployer en production.
 - En production, assurez-vous que `NODE_ENV=production` pour activer le flag `secure` sur le cookie de session.

Note sur l'aperçu PDF (dev):
- L'endpoint de preview A4 (`GET /api/invoices/:id/pdf/preview`) est **désactivé par défaut** pour des raisons de sécurité.
- Pour l'activer en développement uniquement, ajoutez `ENABLE_PREVIEW=true` dans `backend/.env`.
- En production, ne pas activer `ENABLE_PREVIEW` — utilisez l'endpoint protégé `/api/invoices/:id/pdf`.

Comportement fourni:
- Login utilisateur (utilisateurs seedés: `gerant`/`password`, `admin`/`adminpass`).
- Formulaire de facture (ajout lignes, calcul total, enregistrement via API).
- Vue ticket (format compact, bouton d'impression, QR code généré).
- Page admin pour lister/supprimer/imprimer les factures.

Remarques et améliorations possibles:
- Stockage sécurisé des mots de passe (déjà hashés mais tokénisation/JWT manquante).
- Validation complète côté serveur et côté client.
- Upload d'images, conversion USD/CDF, rapports et export CSV.
- Packaging en Docker et déploiement.

