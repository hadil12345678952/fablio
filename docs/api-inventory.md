# Fablio — Inventaire exhaustif des API

> Méthode : lecture de **tous** les fichiers `src/app/api/**/route.ts` (31 fichiers),
> des composants client appelants, plus vérification à l'exécution (voir
> `docs/test-report.md`). Aucune route n'a été omise : l'inventaire est exhaustif
> par construction (une route = un fichier `route.ts` de l'App Router).
>
> Conventions générales
> - **Format** : JSON (sauf l'export CSV et `/api/tts`).
> - **Erreurs** : `{ "erreur": "message en français" }` avec le statut correspondant.
> - **Authentification** : cookie `fablio_session` (httpOnly, SameSite=Lax,
>   `Secure` en production), valeur = 32 octets aléatoires en hexadécimal,
>   validité **30 jours**, contrôlée en base à chaque requête.
> - **Autorisation** : les ressources sont toujours filtrées par propriétaire
>   (`enseignant_id`) ou par rattachement (`eleve.enseignant_id`) ; une ressource
>   appartenant à un autre enseignant est renvoyée en **404** (pas 403), pour ne pas
>   révéler son existence.

---

## 1. API internes — authentification (`/api/auth/**`)

> **Contrôle d'origine (audit 2026-10)** : `src/middleware.ts` s'exécute **avant**
> ces 31 routes pour toute méthode mutante (`POST`/`PUT`/`PATCH`/`DELETE`) sur
> `/api/**`. Si un en-tête `Origin` est présent et ne désigne pas l'hôte public de
> la requête, la réponse est **403** `{erreur:"Origine de la requête non reconnue…"}`
> et **aucun** handler n'est appelé (ni session, ni base). Les requêtes sans `Origin`
> et tous les `GET` sont inchangés. Ce statut peut donc s'ajouter aux réponses de
> **toutes** les lignes du tableau ci-dessous.


| Méthode | Chemin | Fichier / fonction | Auth | Entrées | Réponses | Effets de bord |
|---|---|---|---|---|---|---|
| POST | `/api/auth/enseignant/inscription` | `api/auth/enseignant/inscription/route.ts` → `POST` | — | `{ nom, email, motDePasse }` | `200 {ok:true,id}` · `400` (nom 2–60, e-mail regex, mot de passe ≥ 8) · `409` e-mail déjà pris | INSERT `enseignants` (bcrypt coût 10) + **session ouverte** (cookie posé) |
| POST | `/api/auth/enseignant/connexion` | `api/auth/enseignant/connexion/route.ts` → `POST` | — | `{ email, motDePasse }` | `200 {ok:true}` · `400` corps invalide · `401` identifiants · **`429` + `Retry-After` au-delà de 5 échecs en 15 min** (anti-force-brute, audit 2026-10) | INSERT `sessions` + cookie ; UPSERT dans `tentatives_connexion` à l'échec, DELETE de la ligne à la réussite. **Le bornage est consulté AVANT bcrypt** (un attaquant ne peut plus faire payer 12 rounds de hachage par requête) |
| POST | `/api/auth/eleve/inscription` | `api/auth/eleve/inscription/route.ts` → `POST` | — | `{ pseudo, code, pin }` | `200 {ok:true,id}` · `400` (pseudo `^[\p{L}\p{N}_-]{2,20}$`, code ≥ 4, PIN 4–12) · `404` code inconnu/inactif · `409` pseudo déjà utilisé dans la classe | INSERT `eleves` (PIN bcrypt) + session |
| POST | `/api/auth/eleve/connexion` | `api/auth/eleve/connexion/route.ts` → `POST` | — | `{ pseudo, code, pin }` | `200 {ok:true}` · `401` code invalide/désactivé **ou** pseudo/PIN incorrect · **`429` + `Retry-After` au-delà de 5 échecs en 10 min** | INSERT session ; comparaison du pseudo en `lower()` (insensible à la casse), code **mis en majuscules** ; clé de bornage = SHA-256 de `code\|pseudo` (un élève bloqué ne bloque pas toute la classe) |
| POST | `/api/auth/deconnexion` | `api/auth/deconnexion/route.ts` → `POST` | session | — | `200 {ok:true}` | DELETE de la session en base + suppression du cookie |
| GET | `/api/auth/moi` | `api/auth/moi/route.ts` → `GET` | facultative | — | `200 {session: null}` ou `{session:{type:"enseignant",nom,email}}` ou `{session:{type:"eleve",pseudo}}` | Aucun hachage n'est jamais renvoyé (vérifié) |

## 2. API internes — récupération de mot de passe (enseignant)

| Méthode | Chemin | Fichier / fonction | Auth | Entrées | Réponses | Effets de bord |
|---|---|---|---|---|---|---|
| POST | `/api/auth/mot-de-passe/demande` | `.../demande/route.ts` → `POST` → `creerDemandeReinitialisation` | — | `{ email }` | **Toujours** `200 {ok:true,message}` (anti-énumération : réponse **octet pour octet identique** pour un compte inconnu — vérifié par empreinte MD5) ; `400` si e-mail mal formé | Si le compte existe **et** quota non atteint : invalide les jetons actifs, INSERT `jetons_reinitialisation` (SHA-256 du jeton, +60 min) puis e-mail Resend **ou** journalisation serveur. Jamais de jeton dans la réponse HTTP |
| GET | `/api/auth/mot-de-passe/reinitialiser?jeton=…` | `.../reinitialiser/route.ts` → `GET` → `verifierJeton` | — | query `jeton` | `200 {valide:true,email}` · `200 {valide:false,raison}` (jeton < 20 car., inconnu, déjà utilisé, expiré, compte introuvable) | Aucun |
| POST | `/api/auth/mot-de-passe/reinitialiser` | `.../reinitialiser/route.ts` → `POST` → `appliquerNouveauMotDePasse` | — | `{ jeton, motDePasse }` | `200 {ok:true,message}` · `400` (mot de passe < 8, jeton invalide/expiré/consommé — messages distincts) | **Transaction** : UPDATE du hash bcrypt + `utilise_le` du jeton + **DELETE de toutes les sessions de l'enseignant** (révocation — vérifié : 5 sessions → 0, seule la reconnexion ultérieure crée une session) |

**Garde-fous métier de ce module** (constantes dans `src/lib/recuperation.ts`) :
jeton `crypto.randomBytes(32).toString("base64url")` (43 caractères — vérifié) ;
durée **60 min** ; **usage unique** ; **un seul jeton actif** (les précédents sont
invalidés à chaque demande — vérifié) ; **quota 3 demandes / 15 minutes / compte**
(vérifié : la 4ᵉ demande renvoie le même 200 sans créer de jeton).

## 3. API internes — espace enseignant

### 3.1 Fables

| Méthode | Chemin | Fichier → fonction | Entrées | Codes | Notes / effets |
|---|---|---|---|---|---|
| GET | `/api/enseignant/fables` | `enseignant/fables/route.ts` → `fablesDeEnseignant()` | — | `200 {fables:[…]}` · `401` | Lecture seule ; chaque carte porte `nbExercices`, `nbExercicesPublies`, `nbCibles` |
| POST | `/api/enseignant/fables` | idem → `POST` | `{titre,texte,morale?,imageUrl?,audioUrl?,videoUrl?,difficulte?,publie?,cibleCodeIds?}` | `200 {ok:true,fable}` · `400` · `401` | `validerChampsFable` : titre 2–120, texte ≥ 10, morale ≤ 300, difficulté ∈ {facile,moyen,difficile}, image normalisée (`normaliserUrlImage`) puis `urlImageValide`, vidéo reconnue par `normaliserVideo` ; INSERT `fables` |
| GET | `/api/enseignant/fables/[id]` | `fables/[id]/route.ts` → `GET` | — | `200 {fable,exercices:[…]}` · `404` · `401` | Renvoie la **liste des exercices** (pas les blocs — ceux-ci passent par `/blocs`) |
| PUT | `/api/enseignant/fables/[id]` | idem → `PUT` | soit `{publie:boolean}` **seul**, soit n'importe quel sous-ensemble de champs | `200 {ok:true,fable}` · `400` (+ `detailsValidation[]` si publication refusée) · `404` | Fusion `{…fable, …corps}` puis revalidation complète. **Bascule de publication validée** par `validerFablePourPublication` ; la dépublication est toujours autorisée |
| DELETE | `/api/enseignant/fables/[id]` | idem → `DELETE` | — | `200 {ok:true}` · `404` | DELETE `fables` → **cascade** sur exercices, blocs, tentatives |
| PUT | `/api/enseignant/fables/[id]/ordre-exercices` | `fables/[id]/ordre-exercices/route.ts` → `PUT` | `{ids:[…]}` | `200` · `400` liste vide · `403` si un id n'appartient pas à la fable · `404` · `401` | `UPDATE exercices SET ordre = index` en parallèle (pas de transaction) |

### 3.2 Exercices

| Méthode | Chemin | Fichier → fonction | Entrées | Codes | Notes |
|---|---|---|---|---|---|
| POST | `/api/enseignant/exercices` | `enseignant/exercices/route.ts` → `POST` | `{fableId,type,consigne,payload,points?,feedbackCorrect?,feedbackIncorrect?,publie?,maxTentatives?}` | `200 {ok:true,exercice}` · `400` · `404` fable inconnue/étrangère | `validerChampsExercice` (points bornés 1–100, feedbacks ≤ 300, `maxTentatives` 1–20 ou `null` sinon, payload validé par type) ; l'`ordre` est calculé = max+1 |
| PUT | `/api/enseignant/exercices/[id]` | `exercices/[id]/route.ts` → `PUT` | sous-ensemble de champs | `200 {ok:true,exercice}` · `400` (dont **changement de type interdit**) · `404` | Fusion puis revalidation |
| DELETE | `/api/enseignant/exercices/[id]` | idem → `DELETE` | — | `200` · `404` | Cascade sur tentatives et blocs référencés |
| — | *(il n'existe **pas** de `GET /api/enseignant/exercices/[id]`)* | — | — | `405` | Observable : la méthode GET n'est pas implémentée — les exercices se lisent via `GET /api/enseignant/fables/[id]` |

### 3.3 Blocs pédagogiques (parcours)

| Méthode | Chemin | Fichier → fonction | Entrées | Codes | Notes / effets |
|---|---|---|---|---|---|
| GET | `/api/enseignant/fables/[id]/blocs` | `fables/[id]/blocs/route.ts` → `blocsDeFable()` | — | `200 {blocs:[…]}` · `404` · `401` | Dégrade en `{blocs:[]}` si la table `blocs_fable` n'existe pas |
| POST | `/api/enseignant/fables/[id]/blocs` | idem → `creerBloc()` | `{type,titre?,contenu?,exerciceId?,position?}` | `200 {ok:true,bloc}` · `400` (type inactif, HTML actif, source vidéo non autorisée, exercice étranger à la fable, **base non migrée**) · `404` | Validation **brouillon** (tolérante : un bloc vide est accepté) ; INSERT dans une transaction avec verrou `FOR UPDATE` puis `normaliserOrdres()`. L'ordre renvoyé est l'ordre **réellement attribué** (0, 1, 2…) : les blocs s'ajoutent **à la suite** ✅ corrigé (voir `docs/business-logic.md` §6) |
| PUT | `/api/enseignant/blocs/[id]` | `blocs/[id]/route.ts` → `modifierBloc()` | `{titre?,contenu?,visible?,exerciceId?}` | `200 {ok:true,bloc}` · `400` · `404` | Met à jour `modifie_le` ; la référence `exercice_id` est écrite dans **la colonne dédiée** |
| DELETE | `/api/enseignant/blocs/[id]` | idem → `supprimerBloc()` | — | `200 {ok:true}` · `404` | Supprime **uniquement le bloc** ; l'exercice référencé et ses tentatives sont conservés (vérifié à l'exécution) ; renumérotation par `normaliserOrdres()` qui **préserve l'ordre relatif** des blocs restants (✅ corrigé, voir `docs/business-logic.md` §6) |
| GET | `/api/enseignant/blocs/[id]` | idem → `GET` | — | `200 {bloc}` · `404` | Lecture unitaire |
| POST | `/api/enseignant/blocs/[id]/deplacer` | `blocs/[id]/deplacer/route.ts` → `deplacerBloc()` | `{delta: 1 \| -1}` | `200 {ok:true}` · `400` delta invalide · `404` | Échange avec le voisin ; si déjà premier/dernier → `200` sans effet |
| POST | `/api/enseignant/blocs/[id]/dupliquer` | `blocs/[id]/dupliquer/route.ts` → `dupliquerBloc()` | — | `200 {ok:true,bloc}` · `400` · `404` | Copie **indépendante** (contenu JSON cloné, type et référence d'exercice conservés) insérée **juste après sa source** (`ordre + 1`) ; pour un bloc exercice, **la même référence d'exercice est réutilisée** (pas de duplication de l'exercice) |
| PUT | `/api/enseignant/fables/[id]/blocs/ordre` | `fables/[id]/blocs/ordre/route.ts` → `reordonnerBlocs()` | `{ids:[…]}` (liste **complète**) | `200 {ok:true}` · `400` (liste ≠ contenu de la fable, doublons) · `401` | Transaction + `FOR UPDATE` ; renumérotation **explicite** 0..n-1 dans une transaction (c'est le remède à l'anomalie d'ordre de la création : après cet appel, l'ordre est celui demandé) ; **vérifie l'invariant de contiguïté** et lève une erreur sinon |

### 3.4 Codes de parrainage

| Méthode | Chemin | Fichier → fonction | Entrées | Codes | Notes |
|---|---|---|---|---|---|
| GET | `/api/enseignant/codes` | `enseignant/codes/route.ts` → `codesDeEnseignant()` | — | `200 {codes:[{id,code,etiquette,actif,nbEleves,creeLeISO}]}` | Tri par création, effectif calculé par code |
| POST | `/api/enseignant/codes` | idem → `POST` | `{etiquette?}` (≤ 40 car.) | `200 {ok:true,code}` · `401` · `500` après 5 collisions d'unicité | `genererCodeParrainage()` : préfixe alphanumérique + 5 caractères tirés de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` via `crypto.getRandomValues` |
| PATCH | `/api/enseignant/codes/[id]` | `codes/[id]/route.ts` → `PATCH` | `{actif?,etiquette?}` | `200 {ok:true,code}` · `400` « Rien à modifier » · `404` | Désactiver un code empêche **toute** connexion/inscription d'élève avec ce code |
| DELETE | `/api/enseignant/codes/[id]` | idem → `DELETE` | — | `200` · `404` | `eleves.code_id` passe à `NULL` (`ON DELETE SET NULL`) — les élèves et leur historique subsistent |

### 3.5 Statistiques, correction et export

| Méthode | Chemin | Fichier → fonction | Entrées | Codes | Notes |
|---|---|---|---|---|---|
| GET | `/api/enseignant/stats/synthese` | `stats/synthese/route.ts` → `syntheseEnseignant()` | — | `200 {synthese}` | Compteurs, score moyen %, taux de réussite, série 14 jours, taux par fable, 8 dernières activités |
| GET | `/api/enseignant/stats/eleves` | `stats/eleves/route.ts` → `statsEleves()` | — | `200 {eleves:[…]}` | Tri alphabétique français ; `scoreMoyenPct` `null` si aucune note |
| GET | `/api/enseignant/stats/eleves/[id]` | `stats/eleves/[id]/route.ts` → `detailEleveStats()` | — | `200 {detail}` · `404` (élève inexistant **ou** d'un autre enseignant) | Détail par fable, série 14 jours, historique (15 dernières) |
| PATCH | `/api/enseignant/stats/eleves/[id]` | idem → `PATCH` | `{pin}` (4–12) | `200 {ok:true}` · `400` · `404` | Réinitialisation du PIN par l'enseignant (parcours « mot de passe oublié » des élèves, sans e-mail). Vérifié : ancien PIN refusé, nouveau accepté |
| GET | `/api/enseignant/stats/fables/[id]` | `stats/fables/[id]/route.ts` → `statsFable()` | — | `200 {stats}` · `404` | Par exercice : distributions (QCM, vrai/faux, vidéo), erreurs fréquentes par trou, file d'attente de correction ; par élève : tentatives/meilleure note/temps |
| GET | `/api/enseignant/export/resultats.csv` | `export/resultats.csv/route.ts` → `donneesExportCsv()` | — | `200 text/csv; charset=utf-8` · `401` | `Content-Disposition: attachment; filename="resultats-fablio.csv"` ; **BOM UTF-8 `EF BB BF`** (vérifié sur les octets), séparateur `;`, en-têtes `Eleve;Classe / code;Fable;Exercice;Type;Tentative n°;Score;Score max;Reussi;Duree (s);Date` ; échappement `"` ; « en attente » pour les corrections non faites |
| PATCH | `/api/enseignant/reponses/[id]` | `reponses/[id]/route.ts` → `PATCH` | `{score}` (0 ≤ score ≤ `max_score`) | `200 {ok:true,tentative}` · `400` hors barème · `404` (réponse d'un autre enseignant) | Arrondi au quart, `corrige_le` positionné, `est_correct = score >= max_score` |

## 4. API internes — espace élève

| Méthode | Chemin | Fichier → fonction | Auth | Codes | Notes |
|---|---|---|---|---|---|
| GET | `/api/eleve/fables` | `eleve/fables/route.ts` → `fablesPourEleve()` | élève | `200 {fables}` · `401` | Uniquement les fables **publiées** de son enseignant, filtrées par `cible_code_ids` (vide = toutes) |
| GET | `/api/eleve/progression` | `eleve/progression/route.ts` → `progressionEleve()` | élève | `200 {progression}` · `401` | `pointsCumules` = somme des **meilleurs** scores par exercice ; 20 dernières tentatives |
| POST | `/api/exercices/[id]/soumettre` | `exercices/[id]/soumettre/route.ts` → `POST` | élève | `200 {ok:true,resultat}` · `400` · `401` · `403` (fable non affectée au groupe) · `403` (tentatives épuisées) · `404` exercice non publié/inconnu | Contrôles successifs : exercice publié → fable publiée **et du même enseignant** → ciblage par code → quota → notation → INSERT tentative. `dureeSecondes` borné 0–3600. `numero` = nb de tentatives + 1. La réponse contient `feedback`, `correction[]` (seulement si `est_correct === false`), `tentativesUtilisees`, `tentativesRestantes` |

## 5. API internes — utilitaires

| Méthode | Chemin | Fichier → fonction | Auth | Codes | Notes |
|---|---|---|---|---|---|
| GET | `/api/health` | `health/route.ts` → `GET` | — | `200 {ok:true, courriel:"resend"\|"journal", bornage:"actif"\|"inactif (désactivé)"\|"indisponible (table manquante ?)", schemaManquant:[…]}` · `500 {ok:false}` | Exécute réellement `select 1` sur PostgreSQL (`dynamic = "force-dynamic"`) ; `courriel` indique le transport d'e-mail actif (diagnostic « les enseignants ne reçoivent pas leur lien ») ; `bornage` et `schemaManquant` (audit 2026-10) donnent l'état de l'anti-force-brute et la liste des tables attendues absentes — **sans aucune donnée secrète ni personnelle** |
| POST | `/api/tts` | `tts/route.ts` → `POST` | **session requise** (enseignant ou élève) | `200 audio/mpeg` · `400` texte < 2 car. · `401` · `502` (fournisseurs indisponibles) | Voir §7. Texte tronqué à 4 000 caractères. En-têtes de réponse : `Content-Type: audio/mpeg`, `Cache-Control: private, max-age=3600`, `X-Fournisseur-Tts` |

---

## 6. Routes de pages (rendu serveur, non-API)

`/` (vitrine), `/connexion`, `/inscription`, `/mot-de-passe/oublie`,
`/mot-de-passe/reinitialiser`, `/enseignant` (tableau de bord), `/enseignant/fables`,
`/enseignant/fables/nouvelle`, `/enseignant/fables/[id]` (éditeur), `/enseignant/codes`,
`/enseignant/eleves`, `/enseignant/eleves/[id]`, `/enseignant/statistiques`,
`/eleve` (tableau de bord), `/eleve/fables/[id]` (lecture), `/eleve/profil`,
`/icon.svg`, `/_not-found` → **16 pages**, toutes dynamiques (`ƒ`) sauf
`/mot-de-passe/{oublie,reinitialiser}` et `/icon.svg` (statiques).

---

## 7. API externes consommées par le projet

| Service | Appel | Implémentation | Authentification | Obligatoire ? | Repli si absent/indisponible |
|---|---|---|---|---|---|
| **Resend** (e-mail) | `POST https://api.resend.com/emails` | `src/lib/courriel.ts` → `envoyerCourriel()` (fetch natif, **pas de SDK**) | `Authorization: Bearer $RESEND_API_KEY` | non | Si la clé est absente : le message (et le **lien de réinitialisation**) est écrit dans les **journaux du serveur** et jamais renvoyé au navigateur. Si l'appel échoue : `"echec"` journalisé, la réponse HTTP reste neutre |
| **OpenAI TTS** | `POST https://api.openai.com/v1/audio/speech` | `src/app/api/tts/route.ts` → `viaOpenAi()` | `Authorization: Bearer $OPENAI_API_KEY` | non | Modèle `OPENAI_TTS_MODEL` (défaut `gpt-4o-mini-tts`), voix `OPENAI_TTS_VOICE` (défaut `shimmer`), `response_format: mp3`, `speed: 0.95`, entrée ≤ 4 000 car. En cas d'échec → repli Google Translate |
| **Google Translate TTS** | `GET https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=fr&…` | idem → `viaGoogleTranslate()` | aucune (service public) | non | Texte découpé en segments ≤ 190 caractères (respect de la ponctuation), trames MP3 concaténées, `User-Agent` et `Referer` imités. Si échec → **HTTP 502** avec message invitant à utiliser la voix du navigateur (vérifié : `ECONNRESET` dans l'environnement d'analyse → 502 explicite) |

**Aucun autre appel serveur sortant n'existe** : `git grep "fetch("` sur `src/lib` et
`src/app/api` ne remonte que ces trois services.

## 8. Appels tiers déclenchés **depuis le navigateur** (iframes / scripts)

| Origine | Utilisation | Implémentation | Notes de sécurité |
|---|---|---|---|
| `https://www.youtube.com/iframe_api` | pilotage de la vidéo interactive (YouTube) | `src/components/exercice/video-interactive.tsx` | Chargé dynamiquement ; l'URL d'intégration est construite par `normaliserVideo()` en `youtube-nocookie.com/embed/…` |
| `<iframe>` vidéo | YouTube / Vimeo / Google Drive (`/preview`) | mêmes fichiers + `fables.video_url` | Pause automatique possible uniquement pour YouTube et les fichiers directs (**`interactif: true`**) ; pour Vimeo/Drive l'UI l'indique explicitement |
| `<iframe>` H5P | activité H5P (h5p.org, h5p.com, Lumi, LMS…) | `src/components/exercice/activite-h5p.tsx` | `sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"`, protocole `postMessage` restreint à **sa propre** iframe, redimensionnement automatique, hauteur initiale fournie par l'enseignant (200–1400 px) |
| Hôtes d'images arbitraires | illustrations des fables | `next/image` + `next.config.ts` | `remotePatterns` accepte **tout** hôte http(s) — à restreindre si l'on veut éviter l'usage de l'optimiseur comme proxy ouvert |
| `https://fonts.googleapis.com` / `fonts.gstatic.com` | polices Baloo 2 / Nunito / Literata | `src/app/layout.tsx` (`next/font/google`) | Appel **au build** (et non au runtime) ; auto-hébergement des fichiers par Next |
| `https://drive.google.com/…`, `https://lh3.googleusercontent.com/…`, `dl.dropboxusercontent.com`, `1drv.ms` | images fournies par les enseignants | `src/lib/medias.ts` → `normaliserUrlImage()` | Conversions vérifiées : `drive.google.com/file/d/ID/view` → `lh3.googleusercontent.com/d/ID=w1600` ; Dropbox `dl=0 → raw=1` ; OneDrive `?download=1` |

## 9. Webhooks

- **Entrants** : aucun (aucune vérification de signature, aucun `POST` public non
  authentifié en dehors de `/api/auth/**`).
- **Sortants** : aucun.

## 10. Fonctionnalités reposant sur un SDK plutôt qu'un appel HTTP explicite

Aucune. Le projet n'embarque **aucun SDK de fournisseur** (`resend`, `openai`,
`axios`, `nodemailer` sont absents des dépendances) : tous les échanges externes
passent par `fetch` natif, et l'accès à PostgreSQL par le pilote `pg` via Drizzle.

## 11. Appels indirects / dynamiques (à ne pas oublier lors d'une réécriture)

1. **URL fournies par les utilisateurs** : `fables.image_url`, `blocs_fable.contenu->url`
   (image/audio/vidéo), `exercices.payload->videoUrl`, `payload->embedUrl` (H5P) —
   ce sont des points de sortie réseau contrôlés par le contenu de la base.
2. **`normaliserVideo()` / `normaliserUrlImage()` / `normaliserUrlH5p()`** réécrivent
   ces URL avant stockage : la valeur en base **n'est pas** celle saisie.
3. **Rendu `next/image`** : toute URL d'image distante déclenche un appel de
   l'optimiseur Next (`/_next/image?url=…`), donc une requête sortante **côté serveur**.
4. **`/api/tts`** est appelé par le bouton « Écouter la fable », mais aussi en repli
   par `speechSynthesis` du navigateur (aucun appel serveur dans ce cas).
5. **Migrations** : `scripts/setup-db.mjs`, `migrer-blocs.mjs`, `seed.mjs` ouvrent
   leur propre connexion `pg` (indépendante du pool de l'application) et sont à
   lancer explicitement — il n'existe **aucune migration automatique au démarrage**.
