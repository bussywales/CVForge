/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import InviteAttribution from "@/app/app/ops/users/invite-attribution";

describe("InviteAttribution", () => {
  it("renders invite attribution details", () => {
    render(
      <InviteAttribution
        profile={{
          invite_id: "12345678-aaaa-bbbb-cccc-123456789012",
          invite_source: "email",
          invited_at: "2024-01-01T00:00:00.000Z",
          invited_email_hash: "hashvalue12345678",
        }}
      />
    );
    expect(screen.getByText(/Invite attribution/i)).toBeTruthy();
    expect(screen.getByText(/Invite ID:/i).textContent).toContain("12345678");
    expect(screen.getByText(/Source:/i).textContent).toContain("email");
    expect(screen.getByText(/Invited at:/i).textContent).toContain("2024-01-01");
    expect(screen.getByText(/Email hash:/i).textContent).toContain("hash:");
  });

  it("does not render when no profile", () => {
    const { container } = render(<InviteAttribution profile={null} />);
    expect(container.textContent).toBe("");
  });
});
