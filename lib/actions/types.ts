export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  id?: string;
};

export const initialActionState: ActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};
