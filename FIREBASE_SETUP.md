# Configuration Firebase pour Eraste Business

## Étape 1: Créer un projet Firebase

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Cliquez sur **"Ajouter un projet"**
3. Nom du projet: `erastebusiness`
4. Acceptez les conditions et créez le projet

## Étape 2: Activer Firestore Database

1. Dans votre projet Firebase, allez dans **"Firestore Database"**
2. Cliquez sur **"Créer une base de données"**
3. Choisissez le mode: **"Production"** 
4. Sélectionnez la région: **us-east1** (proche de Vercel)
5. Configurez les règles de sécurité:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Étape 3: Générer la clé de service

1. Allez dans **Paramètres du projet** (⚙️ en haut à gauche)
2. Onglet **"Comptes de service"**
3. Cliquez sur **"Générer une nouvelle clé privée"**
4. Un fichier JSON sera téléchargé (ex: `erastebusiness-firebase-adminsdk-xxxxx.json`)

## Étape 4: Configuration locale (pour tester)

1. Renommez le fichier téléchargé en `firebase-key.json`
2. Placez-le dans `api/firebase-key.json`
3. **IMPORTANT**: Ne commitez JAMAIS ce fichier sur Git!

## Étape 5: Configuration Vercel

1. Ouvrez `firebase-key.json` et copiez tout son contenu
2. Convertissez en Base64:
   ```powershell
   $json = Get-Content api/firebase-key.json -Raw
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
   ```
3. Copiez le résultat (très long)

4. Sur Vercel Dashboard → **Settings** → **Environment Variables**:
   - Variable: `FIREBASE_SERVICE_ACCOUNT`
   - Value: Collez le Base64
   - Cochez: Production, Preview, Development

## Étape 6: Initialiser les données

```bash
cd api
node init-firebase.js
```

Cela créera:
- Admin: `admin` / `admin123`
- Vendeur: `vendeur_2025` / `vendeur123`

## Étape 7: Tester localement

```bash
cd backend
node index.js
```

L'application devrait se connecter à Firebase ✓

## Étape 8: Déployer sur Vercel

```bash
git add .
git commit -m "Add Firebase integration"
git push origin main
```

Vercel redéploiera automatiquement avec Firebase!

## ⚠️ Sécurité Production

Avant la mise en production, changez les règles Firestore:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    match /invoices/{invoiceId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
