# Mise en service du paiement Stripe (joker)

Le code est prêt (fonctions Supabase Edge + branchement dans `index.html`),
mais il reste des étapes à faire **vous-même**, car elles nécessitent des
clés secrètes qui ne doivent jamais être commitées dans le dépôt.

## 1. Récupérer les clés Stripe

Dans le [dashboard Stripe](https://dashboard.stripe.com/apikeys) (mode test
d'abord, puis mode live quand vous êtes prêt) :
- `STRIPE_SECRET_KEY` : clé secrète (`sk_test_...` ou `sk_live_...`)

## 2. Installer et lier la Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref slvpdoovurqfykplefxe
```

## 3. Créer la table `Jokers`

```bash
supabase db push
```

Cela applique `supabase/migrations/20260916000000_create_jokers_table.sql`.
Si vos tables `Aventures`/`Indices` n'utilisent pas des identifiants
`bigint` (type par défaut de Supabase), adaptez les types `aventure_id`
et `indice_id` dans la migration avant de la lancer.

## 4. Configurer les secrets des fonctions

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxxxxx
supabase secrets set SUPABASE_ANON_KEY=sb_publishable_LahEM8Av6dykKdttDABUCg_T-TUMMvt
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx
```

- `SUPABASE_SERVICE_ROLE_KEY` : Project Settings → API → "service_role" key
  dans le dashboard Supabase (jamais côté navigateur, uniquement ici).
- `STRIPE_WEBHOOK_SECRET` : voir étape 6, à ajouter après création du webhook.

## 5. Déployer les fonctions

```bash
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
```

## 6. Créer le webhook côté Stripe

Dans le dashboard Stripe → Developers → Webhooks → "Add endpoint" :
- URL : `https://slvpdoovurqfykplefxe.supabase.co/functions/v1/stripe-webhook`
- Événement à écouter : `checkout.session.completed`

Une fois créé, Stripe affiche un "Signing secret" (`whsec_...`) :

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
```

Puis redéployez le webhook pour prendre en compte le secret :

```bash
supabase functions deploy stripe-webhook
```

## 7. Tester

Utilisez une [carte de test Stripe](https://docs.stripe.com/testing)
(ex. `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel
CVC) sur une aventure en mode test, et vérifiez que la réponse s'affiche
automatiquement après le paiement.

Quand tout fonctionne en mode test, recommencez les étapes 4 et 6 avec vos
clés **live** Stripe pour passer en production.
