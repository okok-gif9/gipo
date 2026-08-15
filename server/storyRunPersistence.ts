export type StoryRunStateChanges = {
  stateSummary: string;
  stateJson: Record<string, unknown>;
  status: "active" | "ended";
  endingTitle?: string | null;
  endingText?: string | null;
};

export async function persistStoryRunState(input: {
  db: { update: (table: any) => any };
  table: any;
  storyRunId: number;
  changes: StoryRunStateChanges;
  whereStoryRunId: (storyRunId: number) => unknown;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const update = input.db.update(input.table) as { set: (values: Record<string, unknown>) => { where: (condition: unknown) => Promise<unknown> } };
  return update
    .set({ ...input.changes, updatedAt: now, lastInteractionAt: now })
    .where(input.whereStoryRunId(input.storyRunId));
}
