// Crée une session Stripe Checkout pour l'achat d'un joker (10 €).
// La clé secrète Stripe n'est jamais exposée au navigateur : elle vit
// uniquement dans les secrets de la fonction (voir STRIPE_SETUP.md).
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const PRIX_JOKER_CENTIMES = 1000; // 10 €

const enTetesCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: enTetesCors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Méthode non autorisée" }), {
      status: 405,
      headers: { ...enTetesCors, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { ...enTetesCors, "Content-Type": "application/json" },
      });
    }

    const { aventure_id, indice_id, return_url } = await req.json();

    if (!aventure_id || !indice_id || !return_url) {
      return new Response(JSON.stringify({ error: "Paramètres manquants" }), {
        status: 400,
        headers: { ...enTetesCors, "Content-Type": "application/json" },
      });
    }

    // Le site peut être hébergé sous un sous-chemin (ex: GitHub Pages,
    // https://xxx.github.io/Outdoor--secret/), donc on se base sur l'URL
    // de retour envoyée par le site plutôt que sur l'origine seule. On
    // vérifie qu'elle pointe bien vers le même site que celui qui appelle
    // la fonction, pour éviter une redirection vers un domaine tiers.
    const origin = req.headers.get("origin") || "";
    if (!return_url.startsWith(origin)) {
      return new Response(JSON.stringify({ error: "URL de retour invalide" }), {
        status: 400,
        headers: { ...enTetesCors, "Content-Type": "application/json" },
      });
    }

    // Vérifie que l'indice appartient bien à l'aventure indiquée avant de
    // faire payer quoi que ce soit.
    const { data: indice, error: indiceError } = await supabase
      .from("Indices")
      .select("id, aventure_id")
      .eq("id", indice_id)
      .eq("aventure_id", aventure_id)
      .single();

    if (indiceError || !indice) {
      return new Response(JSON.stringify({ error: "Indice introuvable" }), {
        status: 404,
        headers: { ...enTetesCors, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: PRIX_JOKER_CENTIMES,
            product_data: { name: "Joker Outdoor" },
          },
        },
      ],
      metadata: {
        user_id: userData.user.id,
        aventure_id: String(aventure_id),
        indice_id: String(indice_id),
      },
      success_url:
        return_url +
        "?joker_session_id={CHECKOUT_SESSION_ID}&aventure_id=" +
        aventure_id +
        "&indice_id=" +
        indice_id,
      cancel_url: return_url + "#jouer-aventure",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...enTetesCors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Erreur serveur" }), {
      status: 500,
      headers: { ...enTetesCors, "Content-Type": "application/json" },
    });
  }
});
