# Filtres de vendeurs pour Wallapop

[English](README.md) · [Español](README.es.md) · Français · [Deutsch](README.de.md) · [Italiano](README.it.md) · [Português](README.pt.md)

Extension locale et open source pour **Chrome et Edge** : filtre les résultats chargés selon le nombre d'avis du vendeur et une preuve explicite de vérification d'identité. Manifest V3, JavaScript, licence MIT. Aucun serveur applicatif, télémétrie, abonnement ou appel à une IA.

**Périmètre actuel :** uniquement `https://es.wallapop.com/`. L'interface reste en espagnol. Ces traductions ne prennent pas en charge d'autres domaines Wallapop et ne traduisent pas l'extension. Projet indépendant, sans affiliation avec Wallapop.

## Installation

1. Dans ce dépôt, choisissez **Code → Download ZIP**, puis extrayez l'archive dans un dossier permanent.
2. Dans la barre d'adresse de **Google Chrome**, saisissez `chrome://extensions`. Pour **Microsoft Edge**, utilisez `edge://extensions`. Il faut utiliser le navigateur, pas l'Explorateur de fichiers Windows.
3. Activez le **mode développeur** et choisissez **Charger l'extension non empaquetée**.
4. Sélectionnez le dossier **`extension`**, par exemple `wallapop-seller-filter-main/extension`. Sa racine doit contenir `manifest.json`. Ne sélectionnez ni Documents ni la racine du dépôt.
5. Ouvrez une recherche sur [Wallapop Espagne](https://es.wallapop.com/). Rechargez l'onglet s'il était déjà ouvert : le panneau **Reputación del vendedor** apparaît au-dessus des résultats.

Node.js et les assistants de développement ne sont pas nécessaires pour utiliser l'extension. Après compilation, le dossier `dist` peut aussi être chargé.

## Utilisation

- **Filtrado activo** : active le filtrage strict ; le désactiver rétablit les annonces sans recharger la page.
- **Mínimo de reseñas** : nombre minimal d'avis, 5 par défaut. Le critère est **nombre d'avis ≥ minimum** : 5 avis satisfont un minimum de 5. Il s'agit du total du profil, pas des étoiles ni seulement des avis de vente.
- **Solo identidad verificada** : exige une preuve explicite d'identité personnelle. Une vérification commerciale ou l'absence d'insigne reste un état inconnu.
- **Mostrar sin comprobar** : affiche aussi les annonces en attente, inconnues et en erreur, avec une étiquette.
- **Comprobar 10 más** : traite jusqu'à dix URL encore jamais tentées. Après le premier lot, la suite est manuelle.
- **Reintentar errores** : réessaie jusqu'à dix URL en erreur sans vider le cache ni reconsulter les résultats connus ou inconnus.
- **Actualizar datos** : vide le cache partagé et traite de nouveau jusqu'à dix annonces.
- **Reanudar consultas** : reprend manuellement après une limitation ou un blocage.

Les compteurs distinguent correspondances, exclusions, requêtes en cours, annonces non tentées, données inconnues et erreurs. **Traité ne signifie pas vérifié.** Le bouton de continuation est désactivé quand toutes les annonces chargées ont déjà été traitées, même s'il reste des données inconnues.

Les annonces masquées conservent leur espace et leur ordre pour éviter de déplacer les déclencheurs de défilement. Seuls les **résultats chargés et traités** sont filtrés, pas tout le catalogue. L'absence de correspondances confirmées avec des données incomplètes ne prouve pas qu'il n'existe aucun vendeur adapté.

## Requêtes et confidentialité

Une requête à la fois entre les onglets, au moins trois secondes entre les démarrages, dix URL distinctes par lot. L'extension lit le HTML des annonces liées, sans inventer d'API ni télécharger de code exécutable distant.

Le cache local est valable 24 heures : identifiant du vendeur, avis, preuve d'identité, date, URL source et liens annonce-vendeur. La suppression des entrées expirées se fait à l'accès au cache, pas à heure programmée. Préférences et état de pause sont aussi conservés. Aucune valeur de cookie ou donnée de connexion n'est inspectée ou enregistrée ; les noms, numéros de téléphone et textes d'avis ne sont pas conservés. Les requêtes ordinaires à Wallapop peuvent inclure les cookies de session gérés par le navigateur.

Autorisations : `storage` et `https://es.wallapop.com/*`. HTTP 429 suspend les requêtes et respecte `Retry-After` ; 401/403 ou CAPTCHA les arrêtent jusqu'à une action manuelle. Une erreur ne devient jamais zéro avis. Deux annonces nouvelles du même vendeur peuvent nécessiter deux lectures pour découvrir leur lien ; les liens déjà connus réutilisent le cache du vendeur.

## Mise à jour, développement et limites

Remplacez le dossier permanent, rechargez l'extension sur la page des extensions, puis rechargez Wallapop. Les préférences survivent à un rechargement normal. Pour désinstaller, choisissez **Supprimer**, puis rechargez les onglets ouverts.

Versions de Node.js dans `package.json`. Aucun paquet nécessaire au noyau :

```sh
npm run check
npm test
npm run build
```

Sorties : `dist/` et `wallapop-seller-filters.zip`, avec manifeste et licence MIT à la racine. Tests de navigateur facultatifs :

```sh
npm install --no-save playwright
npx playwright install chromium
npm run test:browser
```

`BROWSER_EXECUTABLE` et `PLAYWRIGHT_MODULE` permettent de choisir des installations existantes. Profil séparé, débogage limité à la machine locale et réponses interceptées : ces tests ne consultent pas Wallapop. CI exécute syntaxe, tests du noyau et compilation ; les tests de navigateur sont séparés.

Trois annonces et profils réels ont été examinés ; un utilisateur a montré le filtrage dans Chrome. La comparaison détaillée avec plusieurs profils dans ce navigateur et l'exécution sous Edge restent à faire. Les fixtures ne prouvent pas l'intégration réelle. Voir [tests](docs/TESTING.md), [recherche](docs/RESEARCH.md) et [maintenance](docs/MAINTENANCE.md).

Contributions et traductions : [CONTRIBUTING.md](CONTRIBUTING.md). Ne publiez pas de données de session ni de captures non anonymisées.

[Licence MIT](LICENSE) · Copyright © 2026 wasonidas.
