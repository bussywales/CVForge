export const WEEKLY_COACH_COPY = {
  ROW: {
    MARK_DONE: "Mark done",
    DONE: "Done",
    UNDO: "Undo",
    MARKED_DONE_HELPER: "Marked done — you completed this step.",
    SAVED: "Saved.",
  },
  PROGRESS: {
    THIS_WEEK: "This week",
    COMPLETED_FMT: "{done}/{total} completed",
    MOMENTUM: "Keep going — momentum compounds.",
  },
  SECTIONS: {
    DO_NEXT: "Do next",
    UP_NEXT: "Up next",
    IF_TIME: "If you have time",
  },
  WEEK_COMPLETE: {
    TITLE: "Week complete",
    SUB: "Nice work — you moved your applications forward.",
    ADD_ONE_MORE: "Add one more step",
    LEAVE_IT: "Leave it there",
  },
  EXPANDER: {
    ALSO_NEEDED_FMT: "Also needed for {n} other applications",
    HIDE: "Hide",
    ALSO_HELPER: "Same step, different roles — knock them out quickly.",
  },
  ERRORS: {
    SAVE_FAILED: "Couldn’t save that.",
    RETRY: "Retry",
  },
  ARIA: {
    MARK_DONE: "Mark this step done",
    UNDO: "Undo completion",
  },
};

export function formatAlsoNeeded(copy: string, count: number) {
  return copy.replace("{n}", String(count));
}

export function formatCompleted(copy: string, done: number, total: number) {
  return copy.replace("{done}", String(done)).replace("{total}", String(total));
}
