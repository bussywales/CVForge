"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";

type AutopackGenerateButtonProps = {
  applicationId: string;
};

type GenerateState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

export default function AutopackGenerateButton({
  applicationId,
}: AutopackGenerateButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<GenerateState>({ status: "idle" });

  const handleGenerate = async () => {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/autopack/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ applicationId }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload?.error ?? "Unable to generate an autopack right now.",
        });
        return;
      }

      const autopackId = payload?.autopackId as string | undefined;
      const creditsRemaining = payload?.creditsRemaining as number | undefined;
      const creditUsed = payload?.creditUsed as boolean | undefined;

      if (autopackId) {
        const params = new URLSearchParams({ generated: "1" });

        if (typeof creditsRemaining === "number" && Number.isFinite(creditsRemaining)) {
          params.set("remaining", String(creditsRemaining));
        }

        if (creditUsed === false) {
          params.set("used", "0");
        }

        router.push(
          `/app/applications/${applicationId}/autopacks/${autopackId}?${params.toString()}`
        );
      }

      router.refresh();
      setState({ status: "idle" });
    } catch (error) {
      setState({
        status: "error",
        message: "Unable to generate an autopack right now.",
      });
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleGenerate}
        disabled={state.status === "loading"}
      >
        {state.status === "loading" ? "Generating..." : "Generate Autopack"}
      </Button>
      {state.status === "error" && state.message ? (
        <p className="text-xs text-red-600">{state.message}</p>
      ) : null}
    </div>
  );
}
