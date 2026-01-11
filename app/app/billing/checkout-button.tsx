"use client";

import { useState } from "react";
import Button from "@/components/Button";

type CheckoutState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

export default function CheckoutButton() {
  const [state, setState] = useState<CheckoutState>({ status: "idle" });

  const handleCheckout = async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          status: "error",
          message: payload?.error ?? "Unable to start checkout.",
        });
        return;
      }

      if (payload?.url) {
        window.location.href = payload.url as string;
        return;
      }

      setState({ status: "error", message: "Checkout URL missing." });
    } catch (error) {
      setState({ status: "error", message: "Unable to start checkout." });
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleCheckout}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Redirecting..." : "Buy 10 credits (£9)"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
