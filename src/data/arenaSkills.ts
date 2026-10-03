/**
 * Arena Strategy Skills for Football Predictions
 * 15 Reasoning Modes × 12 Workflows × 12 Strategies = 2,160 unique cards
 */

export const ARENA_SKILLS = {
  reasoning: [
    {
      id: "first-principles",
      name: "First Principles",
      icon: "🔬",
      how: "Strip the task down to the facts and requirements nobody can argue with. Rebuild the answer from those alone.",
      footballApplication: "Reduce match to raw xG, shot data, and league averages. Ignore narrative, form streaks, and pundit opinion. Build prediction from ground-truth numbers only."
    },
    {
      id: "inversion",
      name: "Inversion",
      icon: "🔄",
      how: "Ask what would make this answer fail. List every way it could, then build the answer that makes each failure impossible.",
      footballApplication: "What would cause Over 2.5 to fail? Red cards, weather, tactical parking of the bus, key injuries. What would cause Under 2.5 to fail? Derbies, desperation games, leaky defenses. Build around failure modes."
    },
    {
      id: "analogy",
      name: "Analogy",
      icon: "🔗",
      how: "Find a problem in a different field that has already been solved and has the same shape. Port its solution over.",
      footballApplication: "Map this fixture to historical matches with similar statistical profiles. Use pattern matching from comparable past games to inform the prediction."
    },
    {
      id: "adversarial",
      name: "Adversarial",
      icon: "⚔️",
      how: "Picture the harshest expert reviewer trying to tear the answer apart. Write their attacks first and build backwards.",
      footballApplication: "Assume a sharp bettor is trying to find why this prediction is wrong. What data points contradict it? What market signals disagree? Build the prediction to survive those attacks."
    },
    {
      id: "constraint-first",
      name: "Constraint First",
      icon: "📐",
      how: "List every hard constraint. Solve strictly inside that box and let the tightest constraint drive the design.",
      footballApplication: "Hard constraints: league scoring averages, team defensive records, home/away splits, recent form. The tightest constraint (e.g., both teams average <1.2 goals/game) drives the prediction."
    },
    {
      id: "worked-example",
      name: "Worked Example",
      icon: "📊",
      how: "Solve one concrete, realistic instance end to end first. Generalise only from what that example taught you.",
      footballApplication: "Simulate the match goal-by-goal using Poisson distribution. Run 10,000 iterations. The concrete simulation results drive the probability estimate."
    },
    {
      id: "socratic",
      name: "Socratic",
      icon: "❓",
      how: "Interrogate the task with the questions a sharp expert would ask before starting.",
      footballApplication: "Key questions: Are both teams motivated? Is the pitch condition conducive to goals? What's the H2H trend? Are key attackers fit? Answer each before predicting."
    },
    {
      id: "contrarian",
      name: "Contrarian",
      icon: "↩️",
      how: "Write down the obvious default answer, then argue seriously against it.",
      footballApplication: "The market says Over 2.5 at 1.85. Why might the market be wrong? Look for value in the Under. Or vice versa. Find where consensus is potentially mispriced."
    },
    {
      id: "systems-thinking",
      name: "Systems Thinking",
      icon: "🌐",
      how: "Map the moving parts, how they affect each other, and what happens second and third order.",
      footballApplication: "Consider the full system: team tactics interactions, referee tendencies, league-wide scoring trends, fixture congestion effects, travel fatigue. How do these second-order effects compound?"
    },
    {
      id: "decomposition",
      name: "Decomposition",
      icon: "🧩",
      how: "Break the task into independent sub-problems. Solve each one completely, then integrate.",
      footballApplication: "Separately analyze: home attack vs away defense, away attack vs home defense, set-piece threat, counter-attack vulnerability, then integrate into total goal expectation."
    },
    {
      id: "working-backwards",
      name: "Working Backwards",
      icon: "⏪",
      how: "Describe the finished result precisely, as if it already exists. Then work backwards.",
      footballApplication: "Assume the match ends 2-1 (Over 2.5). What would need to be true? Now assume 1-0 (Under 2.5). What would need to be true? Which scenario's assumptions are more consistent with the data?"
    },
    {
      id: "probabilistic",
      name: "Probabilistic",
      icon: "🎲",
      how: "Treat every claim and choice as uncertain. Weigh what is likely, state your confidence.",
      footballApplication: "Assign probability distributions to each input (attack strength, defense strength, home advantage). Propagate uncertainty through the model. Report confidence intervals, not point estimates."
    },
    {
      id: "dialectical",
      name: "Dialectical",
      icon: "⚡",
      how: "State the strongest version of one answer, then the strongest opposing answer, then synthesize.",
      footballApplication: "Build the strongest case for Over 2.5 (attacking stats, H2H, league trends). Build the strongest case for Under 2.5 (defensive records, low-scoring venues, tactical matchups). Synthesize."
    },
    {
      id: "evidence-first",
      name: "Evidence First",
      icon: "📋",
      how: "Ground every claim in something checkable. Anything you cannot check gets labelled as an assumption.",
      footballApplication: "Only use verified stats: official league data, confirmed lineups, recorded H2H. Flag everything else (injuries from social media, 'team morale') as unverified assumptions."
    },
    {
      id: "expert-panel",
      name: "Expert Panel",
      icon: "👥",
      how: "Answer the task as three different experts would. Take the strongest idea from each.",
      footballApplication: "Analyze as: (1) a statistical modeler, (2) a tactical analyst, (3) a market/odds expert. Combine their strongest insights into the final prediction."
    }
  ],

  workflows: [
    {
      id: "draft-critique-rewrite",
      name: "Draft, Critique, Rewrite",
      icon: "✏️",
      how: "Write a first draft. Critique it line by line. Then rewrite from scratch using the critique.",
      footballApplication: "Generate initial prediction → identify weaknesses in the analysis → rebuild the prediction addressing every weakness found."
    },
    {
      id: "outline-first",
      name: "Outline First",
      icon: "📝",
      how: "Write a skeleton outline, check it against every requirement, fix it, then fill it in.",
      footballApplication: "Map all data sources needed → verify each is available → then build the prediction from confirmed data only."
    },
    {
      id: "test-first",
      name: "Test First",
      icon: "✅",
      how: "Write the checks it must pass first. Then write the answer and run every check.",
      footballApplication: "Define success criteria: Does prediction match historical accuracy? Does edge exceed threshold? Is Kelly fraction reasonable? Only predict if all tests pass."
    },
    {
      id: "research-then-synthesise",
      name: "Research, then Synthesise",
      icon: "🔍",
      how: "Gather every relevant fact first. Write nothing until research is done, then synthesise.",
      footballApplication: "Collect all team stats, form, H2H, league context, odds data, injuries. Only after complete data gathering, generate the prediction."
    },
    {
      id: "three-drafts",
      name: "Three Drafts, Pick One",
      icon: "📑",
      how: "Write three genuinely different approaches. Pick the strongest and develop it fully.",
      footballApplication: "Generate prediction using: (1) pure stats, (2) form-based, (3) market-implied. Select the approach with highest internal consistency."
    },
    {
      id: "requirements-checklist",
      name: "Requirements Checklist",
      icon: "☑️",
      how: "Pull every requirement into a numbered list. Solve, then tick each item off.",
      footballApplication: "Checklist: team data ✓, league context ✓, odds comparison ✓, form analysis ✓, H2H ✓. Only predict when all boxes are checked."
    },
    {
      id: "iterative-deepening",
      name: "Iterative Deepening",
      icon: "🔎",
      how: "Write a one-paragraph answer first. Then expand the parts that matter most.",
      footballApplication: "Quick prediction first (league avg + team strength). Then deepen: add form, H2H, tactical analysis, market edge calculation."
    },
    {
      id: "build-then-break",
      name: "Build, then Break",
      icon: "💥",
      how: "Build the answer. Then throw five hostile scenarios at it and patch every break.",
      footballApplication: "Generate prediction → test against: red card scenario, key injury, weather disruption, tactical surprise, referee variance → adjust for robustness."
    },
    {
      id: "smallest-version-first",
      name: "Smallest Version First",
      icon: "🌱",
      how: "Produce the smallest complete version that works. Then extend it one step at a time.",
      footballApplication: "Start with basic Poisson model → add Dixon-Coles correction → add Monte Carlo → add Kelly criterion. Each step validated before extending."
    },
    {
      id: "options-matrix",
      name: "Options Matrix",
      icon: "📊",
      how: "List the realistic options, score them in a matrix, choose one.",
      footballApplication: "Score Over 2.5 vs Under 2.5 vs No Bet across: statistical edge, market value, confidence level, risk/reward. Matrix determines the pick."
    },
    {
      id: "open-questions-first",
      name: "Open Questions First",
      icon: "🤔",
      how: "List every open question. Resolve each one, then answer.",
      footballApplication: "Open questions: team motivation? key player availability? weather impact? tactical setup? Resolve each before making the prediction."
    },
    {
      id: "write-then-restructure",
      name: "Write, then Restructure",
      icon: "🏗️",
      how: "Write freely and fast. Then outline what you wrote, fix the structure, rewrite.",
      footballApplication: "Generate raw analysis → identify the strongest signal → restructure the prediction around that signal → refine the narrative."
    }
  ],

  strategies: [
    {
      id: "simplest",
      name: "Simplest Thing That Works",
      icon: "✨",
      how: "Pick the least complicated answer that fully does the job.",
      footballApplication: "Use league average + basic team strength. No complex adjustments. If the signal is clear enough at this level, trust it."
    },
    {
      id: "maximal-rigour",
      name: "Maximal Rigour",
      icon: "🔬",
      how: "Be exhaustive and exact. Check every step, verify every claim.",
      footballApplication: "Full Dixon-Coles MLE fitting, Monte Carlo validation, Kelly criterion with fractional adjustment, CLV tracking. No shortcuts."
    },
    {
      id: "user-empathy",
      name: "User Empathy First",
      icon: "👤",
      how: "Start from the person who will use this: their situation, skill level, what they'll do next.",
      footballApplication: "Frame the prediction for the bettor: clear edge %, recommended stake, confidence level. Actionable, not academic."
    },
    {
      id: "edge-cases-first",
      name: "Edge Cases First",
      icon: "⚠️",
      how: "Hunt the edge cases, failure modes and weird inputs first.",
      footballApplication: "Focus on: derby matches, relegation battles, end-of-season dead rubbers, midweek fatigue, new manager bounce. These break models."
    },
    {
      id: "speed",
      name: "Speed",
      icon: "⚡",
      how: "Optimise for the fastest route to something usable today.",
      footballApplication: "Quick heuristic prediction using cached data. Good enough for pre-match analysis when time is limited."
    },
    {
      id: "defensive",
      name: "Defensive",
      icon: "🛡️",
      how: "Assume the inputs are bad and conditions are hostile. Fail safely and loudly.",
      footballApplication: "Assume data might be stale, odds might be sharp, model might be wrong. Require higher edge threshold. Predict NO_BET unless overwhelming evidence."
    },
    {
      id: "clarity",
      name: "Clarity Above All",
      icon: "💎",
      how: "Make it the easiest answer to read and act on.",
      footballApplication: "Simple verdict: OVER/UNDER/NO_BET. One-line reasoning. Clear stake recommendation. No jargon."
    },
    {
      id: "completeness",
      name: "Completeness",
      icon: "📦",
      how: "Leave out nothing the task asks for or clearly implies.",
      footballApplication: "Cover every angle: stats, form, H2H, market, tactical, contextual. Full audit trail of the prediction logic."
    },
    {
      id: "fewest-moving-parts",
      name: "Fewest Moving Parts",
      icon: "🎯",
      how: "Remove things until it breaks, then put the last one back.",
      footballApplication: "Minimal model: just xG differential + home advantage. If that's enough to find edge, don't add complexity."
    },
    {
      id: "explicit-trade-offs",
      name: "Explicit Trade-offs",
      icon: "⚖️",
      how: "Name the real trade-offs, choose for the user's constraints, say what that choice gives up.",
      footballApplication: "State clearly: 'We trade model complexity for speed' or 'We accept lower edge for higher confidence'. Transparent about what's sacrificed."
    },
    {
      id: "built-to-last",
      name: "Built to Last",
      icon: "🏛️",
      how: "Optimise for how this holds up in six months.",
      footballApplication: "Build prediction logic that generalizes across leagues and seasons. No overfitting to recent form. Robust to regime changes."
    },
    {
      id: "concrete-specifics",
      name: "Concrete Specifics",
      icon: "📌",
      how: "Exact numbers, names, commands, file paths and steps. Zero generic advice.",
      footballApplication: "Exact xG values, specific player impacts, precise edge percentages, exact Kelly fraction. No 'might' or 'could'."
    }
  ]
};

// Type exports for convenience
export type ReasoningMode = typeof ARENA_SKILLS.reasoning[number];
export type Workflow = typeof ARENA_SKILLS.workflows[number];
export type Strategy = typeof ARENA_SKILLS.strategies[number];
