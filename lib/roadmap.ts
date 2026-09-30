import data from "@/a2z.json";

export type Topic = {
  id: string;
  question_title: string;
  difficulty: number | null;
  post_link: string | null;
  yt_link: string | null;
  lc_link: string | null;
  gfg_link: string | null;
  cs_link: string | null;
  plus_link: string | null;
};
export type SubStep = { sub_step_no: number; sub_step_title: string; topics: Topic[] };
export type Step = { step_no: number; step_title: string; sub_steps: SubStep[] };

// Ship only fields used by the UI; the source JSON stays compatible with the
// existing Python maintenance scripts.
export const roadmap: Step[] = data.map((step) => ({
  step_no: step.step_no,
  step_title: step.step_title,
  sub_steps: step.sub_steps.map((sub) => ({
    sub_step_no: sub.sub_step_no,
    sub_step_title: sub.sub_step_title,
    topics: sub.topics.map((topic) => ({
      id: topic.id,
      question_title: topic.question_title,
      difficulty: topic.difficulty,
      post_link: topic.post_link,
      yt_link: topic.yt_link,
      lc_link: topic.lc_link,
      gfg_link: topic.gfg_link,
      cs_link: topic.cs_link,
      plus_link: topic.plus_link,
    })),
  })),
}));
export const topics = roadmap.flatMap((s) => s.sub_steps.flatMap((sub) => sub.topics));
export const problemIds = new Set(topics.map((topic) => topic.id));
