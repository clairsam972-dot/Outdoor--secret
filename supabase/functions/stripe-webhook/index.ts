// Webhook Stripe : confirme le paiement d'un joker et débloque la réponse
// côté base de données. Appelé directement par Stripe (pas par le site),
// donc la vérification passe par la signature Stripe, pas par un JWT
// Supabase (voir supabase/config.toml : verify_jwt = false pour cette
// fonction).
import Stripe from "npm:stripe@14";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const secretWebhook = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const corps = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(corps, signature!, secretWebhook);
  } catch (error) {
    console.error("Signature webhook invalide :", error);
    return new Response("Signature invalide", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { user_id, aventure_id, indice_id } = session.metadata || {};

    if (user_id && aventure_id && indice_id) {
      const { error } = await supabaseAdmin.from("Jokers").insert({
        user_id,
        aventure_id,
        indice_id,
        session_id: session.id,
        paid: true,
      });

      if (error) {
        console.error("Erreur enregistrement joker :", error);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
