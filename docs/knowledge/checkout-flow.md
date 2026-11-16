# Parcours d'achat SAIS — la référence

> Décision : **commande en ligne, sans compte obligatoire, confirmation par téléphone, suivi par référence**.
> Paiement à la livraison (COD), livraison 24–48h partout au Maroc.

## 1. Pourquoi ce parcours

Au Maroc, trois réalités décident du bon parcours :

1. **Le téléphone est l'identifiant réel.** La cliente se reconnaît par son numéro, pas par un email.
2. **Le COD domine.** On ne demande donc jamais de carte, et on affiche le montant total dès la confirmation.
3. **Une commande non confirmée n'est pas une vente.** Un appel (ou un WhatsApp) entre la commande et l'expédition est indispensable.

Le parcours retenu reprend ce que font les grandes boutiques (ASOS, LC Waikiki, Shein) sur les points qui comptent :
panier persistant → checkout court → récapitulatif explicite → référence de commande → suivi en libre-service.
Il remplace la commande « envoyez-nous un message WhatsApp » par un vrai tunnel mesurable, **tout en gardant WhatsApp comme canal d'aide**.

## 2. Le tunnel, étape par étape

| Étape | Écran | Ce que la cliente fait | Ce que le système fait |
|---|---|---|---|
| 1 | Fiche produit | taille + coloris, « Ajouter au panier » | panier persistant (localStorage) |
| 2 | Panier (sheet) | vérifie, ajuste les quantités | sous-total + livraison estimée |
| 3 | `/checkout` — **Livraison** | nom, téléphone, adresse, note | normalise le téléphone en `+212…`, vérifie l'adresse |
| 4 | `/checkout` — **Confirmation** | relit, coche « mes informations sont exactes » | prix et frais **recalculés côté serveur** |
| 5 | Écran de succès | reçoit la référence `SAIS-XXXXXXXX` | commande `en_attente`, client créé/mis à jour |
| 6 | `/suivre` | téléphone + référence | statut + récapitulatif, sans compte |
| 7 | Espace admin | appelle, confirme, expédie | statuts + historique |

Points clés :

- **Aucun compte obligatoire.** Un compte reste proposé *après* la commande avec ce message :
  « Créez votre compte avec ce numéro : vos commandes passées seront rattachées. »
- **Une seule confirmation explicite.** L'étape 4 montre exactement ce qui sera livré et où ; le serveur refuse
  une commande si la case n'est pas cochée (`confirmInfo`), même si le navigateur est contourné.
- **Référence courte.** `orderReference(id)` dérive de l'identifiant : lisible au téléphone, aucune migration SQL.
- **WhatsApp reste un raccourci**, pas le passage obligé : le bouton prépare un message avec la référence,
  les articles et les liens photos.

## 3. Rôles — qui voit quoi

| Espace | Accès | Contenu |
|---|---|---|
| Visiteuse | public | boutique, panier, checkout invité, `/suivre` |
| Cliente | compte Supabase (`/login`) | `/account`, `/account/orders/[id]`, coordonnées, favoris |
| Administrateur | `app_metadata.role = 'admin'` | `/admin/**` : commandes, produits, clientes, réglages |

Règles appliquées :

- `/admin/**` est protégé **deux fois** : `proxy.ts` (redirection) et `requireAdmin()` dans le layout admin.
- Une cliente connectée n'accède jamais à `/admin` ; un admin est redirigé vers `/admin` s'il ouvre `/account`.
- Une commande n'est visible par une cliente que si `orders.auth_user_id = auth.uid()` (RLS + `getOrderForUser`).
- Le suivi public passe par `getOrdersByPhone` (service role, server-only) et **exige le téléphone** de la commande.
- Le lien « Admin » n'apparaît dans la navigation que pour un administrateur.

## 4. Cycle de vie d'une commande

```
en_attente → confirmee → expediee → livree
     ↘ annulee (à tout moment)
```

- `en_attente` : commande reçue, à appeler. C'est la file de travail de l'admin.
- `confirmee` : adresse validée par téléphone, préparation.
- `expediee` : remise au livreur.
- `livree` : encaissée. `annulee` : exclue du chiffre d'affaires (dashboard).

Le statut est visible partout avec le même vocabulaire (`lib/orderStatus.ts`) : badge, timeline cliente,
suivi public, tableau admin.

## 5. Où vit le code

```
actions/checkout.ts                  placeOrderAction (public) + trackOrderAction
actions/client.ts                    login / inscription / profil
actions/admin.ts                     produits, statuts, réglages (admin uniquement)
lib/orderStatus.ts                   statuts, libellés, timeline, références
lib/phone.ts                         normalisation +212 et affichage 06 12 34 56 78
lib/store.ts                         accès Supabase (commandes, clientes, réglages)
components/storefront/CheckoutForm   tunnel 2 étapes + écran de confirmation
components/storefront/TrackOrderForm suivi public
components/storefront/OrderTimeline  étapes communes
components/storefront/OrderStatusBadge
app/(storefront)/suivre              suivi sans compte
app/(storefront)/account/orders/[id] détail côté cliente
app/(admin)/admin/orders/[id]        détail côté admin + outils d'appel
```

## 6. Données et sécurité

- Prix, frais de livraison et total sont **toujours** recalculés dans l'action serveur
  (`getStorePrice` + `settings`), jamais pris du panier.
- Tailles et coloris sont vérifiés contre le produit en base.
- Le téléphone est stocké sous une seule forme (`+212XXXXXXXXX`), ce qui permet de rattacher
  les commandes invité au compte créé plus tard (par email **ou** par téléphone).
- Créer un compte avec un numéro déjà utilisé en invité reprend le profil et l'historique au lieu de dupliquer.
- Aucune nouvelle migration : la référence est dérivée de l'`id` existant.

### Comptes sans SMS

Le projet Supabase a `mailer_autoconfirm: false` et le provider téléphone désactivé : un `signUp`
classique demanderait soit un SMS (non configuré), soit un clic dans un email. L'inscription crée donc
le compte via l'API admin (`email_confirm: true`) puis ouvre la session :

- email fourni → c'est l'identité de connexion ;
- pas d'email → identité interne `<212…>@phone.sais.ma`, la cliente se connecte avec son téléphone.

Limite connue : un compte sans email réel ne peut pas utiliser « mot de passe oublié ».

⚠️ **Prérequis projet** : `external.email` doit être activé (Authentication → Sign In / Providers → Email).
Dans ce projet, Email et Phone étaient tous les deux désactivés (`email_provider_disabled`), ce qui bloquait
l'inscription **et** la connexion admin. Tant que ce toggle est off, l'app affiche un message explicite et
annule le compte créé au lieu de laisser un utilisateur fantôme.

## 7. Prochaines briques possibles (non incluses)

1. **Stock par taille/coloris** : bloquer la vente d'une variante épuisée.
2. **Zones de livraison** : tarif par ville au lieu d'un forfait unique.
3. **Codes promo** : remise au panier, en plus de la promo boutique déjà présente.
4. **Notifications** : SMS/WhatsApp automatique au changement de statut (aujourd'hui manuel).
5. **Relance de panier abandonné** : la référence et le téléphone suffisent pour relancer.
6. **Avis clients** : uniquement sur commande livrée, pour éviter le spam.
