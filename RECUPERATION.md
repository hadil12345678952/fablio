# Récupération de mot de passe — Fablio

Deux parcours distincts, dictés par la façon dont les comptes sont créés
sur la plateforme.

| Rôle | Identifiants | Méthode de récupération |
|---|---|---|
| **Enseignant** | email + mot de passe | Lien sécurisé envoyé par courriel (jeton à usage unique, 1 h) |
| **Élève** | pseudo + code de classe + code secret (PIN) — **pas d'email** | L'enseignant réinitialise le code secret depuis la fiche élève |

> Choix assumé : **aucun enfant n'a besoin d'une adresse email.** Exiger un
> courriel pour les élèves serait irréaliste en école primaire ; la
> réinitialisation par l'enseignant est à la fois plus simple et plus sûre
> (l'adulte responsable valide l'identité de l'enfant en présentiel).

---

## 1. Parcours enseignant

```
Connexion → « Mot de passe oublié ? »
   → saisie de l'email
   → réponse TOUJOURS identique (anti-énumération)
   → courriel contenant un lien /mot-de-passe/reinitialiser?jeton=…
   → nouveau mot de passe (8 caractères min., double saisie)
   → toutes les sessions ouvertes sont fermées
   → retour à la connexion
```

### Garanties de sécurité

| Mesure | Détail |
|---|---|
| Jeton aléatoire | 32 octets (`crypto.randomBytes`), encodé base64url |
| Jamais stocké en clair | seul le **SHA-256** du jeton est enregistré |
| Usage unique | `utilise_le` renseigné à la consommation |
| Expiration | 60 minutes |
| Un seul jeton actif | toute nouvelle demande invalide les précédentes |
| Anti-abus | 3 demandes maximum par compte / 15 minutes |
| Anti-énumération | réponse identique que le compte existe ou non |
| Aucune fuite client | le jeton n'apparaît **jamais** dans une réponse API |
| Révocation | les sessions du compte sont supprimées après changement |
| Mots de passe | toujours hachés bcrypt, jamais affichés ni renvoyés |

### Envoi du courriel

`src/lib/courriel.ts` — sans dépendance (appel HTTP direct à l'API Resend) :

- **`RESEND_API_KEY` défini** → le message part réellement, avec **un nouvel
  essai** en cas d'incident réseau/429/5xx et une **clé d'idempotence** (aucun
  doublon possible).
- **Clé absente** → le message (et le lien) est écrit dans les **journaux du
  serveur**, jamais renvoyé au navigateur.
- **Échec d'envoi (403, 422, réseau…)** → la raison exacte **et le message
  complet** (donc le lien) sont journalisés : l'administrateur de
  l'établissement peut toujours transmettre le lien à l'enseignant, le compte
  n'est **jamais** définitivement perdu.

```env
RESEND_API_KEY="re_…"                              # nécessaire pour un envoi réel
COURRIEL_EXPEDITEUR="Fablio <no-reply@ecole.tn>"   # ⚠ voir ci-dessous
NEXT_PUBLIC_URL_SITE="https://fablio.vercel.app"   # recommandé : lien stable
```

> ⚠️ **Pourquoi les enseignants ne recevaient pas le courriel.**
> L'expéditeur par défaut est `Fablio <onboarding@resend.dev>` : c'est l'adresse
> de **test** de Resend, qui n'autorise comme destinataire **que l'adresse du
> titulaire du compte Resend** (toute autre adresse est refusée en 403
> « You can only send testing emails to your own email address »). Pour envoyer
> aux enseignants : **vérifiez un domaine** dans Resend (SPF + DKIM) puis
> indiquez une adresse de ce domaine dans `COURRIEL_EXPEDITEUR`.
>
> **Diagnostic en une requête** : `GET /api/health` →
> `{"ok":true,"courriel":"resend"}` (envoi actif) ou `{"ok":true,"courriel":"journal"}`
> (aucun courriel ne partira : le lien est seulement dans les journaux).

---

## 2. Parcours élève (sans email)

Sur la page « Mot de passe oublié ? », l'onglet **Élève** affiche la marche à
suivre, en langage adapté :

1. l'élève prévient son enseignant ;
2. l'enseignant ouvre **Mes élèves → fiche de l'élève** ;
3. il saisit un nouveau code secret (4 à 12 caractères) et le communique.

Cette fonction existait déjà (`PATCH /api/enseignant/stats/eleves/[id]`) et
n'a **pas été modifiée** : elle vérifie que l'élève appartient bien à
l'enseignant connecté, et hache le nouveau PIN avec bcrypt.

> Un utilisateur non autorisé ne peut jamais modifier le compte d'un enfant :
> l'API exige une session enseignant **et** la propriété de l'élève.

---

## 3. Schéma ajouté

```sql
CREATE TABLE jetons_reinitialisation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enseignant_id uuid NOT NULL REFERENCES enseignants(id) ON DELETE CASCADE,
  jeton_hash    text NOT NULL,          -- SHA-256, jamais le jeton en clair
  expire_le     timestamptz NOT NULL,
  utilise_le    timestamptz,            -- non NULL = déjà consommé
  cree_le       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_jeton_hash ON jetons_reinitialisation(jeton_hash);
CREATE INDEX idx_jeton_enseignant ON jetons_reinitialisation(enseignant_id);
```

Créée automatiquement par `node scripts/setup-db.mjs` (idempotent).
**Aucune table existante n'a été modifiée.**

---

## 4. Routes ajoutées

| Route | Rôle |
|---|---|
| `GET /mot-de-passe/oublie` | Page : choix du profil + demande |
| `GET /mot-de-passe/reinitialiser?jeton=…` | Page : nouveau mot de passe |
| `POST /api/auth/mot-de-passe/demande` | Crée la demande (réponse neutre) |
| `GET /api/auth/mot-de-passe/reinitialiser` | Vérifie la validité du lien |
| `POST /api/auth/mot-de-passe/reinitialiser` | Applique le nouveau mot de passe |

## 5. Tests effectués (serveur réel)

- réponses identiques compte existant / inconnu ✔
- aucun jeton renvoyé au navigateur ✔
- jeton stocké haché SHA-256 ✔
- lien valide reconnu, mot de passe changé ✔
- connexion avec le nouveau mot de passe ✔, ancien refusé ✔
- rejeu du même jeton refusé (usage unique) ✔
- jeton falsifié refusé ✔
