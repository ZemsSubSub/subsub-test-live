// Navigation v2 fixtures: channels, their summaries, ideas and statuses from other products.
// Dates are offsets in days from the moment the page opens, so "Updated" and "Trends as of" stay fresh.
// Sparkline series are generated at the end of this file from the period values, so every curve follows its delta.
window.V2_FIXTURES = {
  user: { name: "Yevhenii Zemskov", initials: "YZ", email: "zemskov@gen.tech" },
  org: { name: "GenTech Studio", slug: "gentech-studio", role: "Manager" },

  // account states: the connected channels and what the Home inbox holds.
  // attention: Needs attention items; dismissed: items already dismissed; caught: every item handled
  states: {
    nochannel: { label: "No channel", channels: [] },
    link: { label: "Link only", channels: ["hunt"], attention: ["payout-method"] },
    approved: { label: "Network application approved", channels: ["zems", "hunt"], attention: ["views-hunt"], resolved: { "status-network": "approved" } },
    declined: { label: "Network application declined", channels: ["zems", "hunt"], resolved: { "status-network": "declined" } },
    oauth: { label: "OAuth", channels: ["zems"] },
    calm: { label: "Nothing broken", channels: ["zems", "hunt"] },
    dismissed: { label: "Partially dismissed", channels: ["zems", "hunt"], attention: ["views-hunt", "payout-failed"],
      dismissed: ["attention-payout-failed", "trend-patch", "insight-hunt-patch-day", "suggest-memberships"], hidden: ["i6"] },
    caught: { label: "Caught up", channels: ["zems"], caught: true },
    small: { label: "Small or empty channel", channels: ["eugene"] },
    generating: { label: "Generation running", channels: ["zems"], generating: "zems" },
    first: { label: "First generation", channels: ["zems"], generating: "zems", first: true },
    noideas: { label: "No ideas yet", channels: ["zems"], noIdeas: true },
    stale: { label: "Ideas older than 7 days", channels: ["zems", "hunt"], staleIdeas: true },
    multi: { label: "Two channels, full inbox", channels: ["zems", "hunt"], attention: ["views-hunt"] }
  },
  dialogStates: {
    saved: "Saved similar channels",
    invalid: "Invalid similar channel link",
    running: "Run already in progress"
  },

  channels: {
    zems: {
      id: "zems", name: "Zems Racing", handle: "@zemsracing", initial: "Z", color: "var(--color-avatar-2)",
      conn: "oauth", subs: 184200, videos: 412, connected: -212, updated: -2, network: true,
      niches: ["Sim racing"], recentUploads: 12, median7: 76000,
      // median change across the reference channels from Analytics, in percent, same periods as summary
      similar: { d7: { subs: 12.0, views: 4.2, revenue: 9.8, watch: 6.1, avd: 1.5, returning: 0.8 },
        d28: { subs: -2.1, views: 6.4, revenue: 3.9, watch: 2.2, avd: 6.0, returning: 0.4 } },
      // earnings by source over the period: YouTube ads (AdSense estimate), Fan Funding, Live donations, Network share
      sources: { d7: { ads: 386.4, fan: 0, live: 211.5, network: 46.4 }, d28: { ads: 1488.9, fan: 0, live: 308, network: 178.7 } },
      suggested: ["drifthq", "simracerdaily", "trackdaytv", "gearheadgarage"],
      savedSimilar: ["youtube.com/@drifthq", "youtube.com/@simracerdaily"],
      summary: {
        d7: { subs: [1240, 980], views: [412300, 371800], revenue: [386.4, 342.1] },
        d28: { subs: [4820, 5110], views: [1631000, 1488000], revenue: [1488.9, 1391.2] }
      },
      // watch time in hours, average view duration in seconds, returning viewers in percent
      deep: {
        d7: { watch: [21480, 19870], avd: [312, 298], returning: [41.2, 39.8] },
        d28: { watch: [84300, 80150], avd: [305, 309], returning: [40.6, 41.3] }
      },
      month: [1240.3, 1102.75],
      videos: [
        { id: "v1", title: "10 cars, 1 lap: the S1 shootout", thumb: "covers/racing.svg", published: -3, views: 184300, views7: 104900, avd: 512, retention: 58 },
        { id: "v2", title: "Fix understeer with one setting", thumb: "covers/speedrun.svg", published: -5, views: 96200, views7: 92700, avd: 41, retention: 87, short: true },
        { id: "v3", title: "Night drift on the new map", thumb: "covers/racing.svg", published: -9, views: 72800, views7: 61200, avd: 388, retention: 46 },
        { id: "v4", title: "Ranking every car you sent me", thumb: "covers/generic.svg", published: -12, views: 131500, views7: 81300, avd: 604, retention: 52 },
        { id: "v5", title: "Wheel or controller: 30 laps each", thumb: "covers/speedrun.svg", published: -16, views: 58900, views7: 47800, avd: 455, retention: 49 },
        { id: "v6", title: "The 4-second pit stop", thumb: "covers/racing.svg", published: -19, views: 210400, views7: 158400, avd: 38, retention: 91, short: true }
      ],
      streams: {
        upcoming: [
          { id: "s3", title: "Sunday endurance: 2 hours, one car", at: 2, time: "18:00" },
          { id: "s4", title: "Subscriber cup, round 3", at: 6, time: "19:30" }
        ],
        recent: [
          { id: "s1", title: "Forza Chill Ride", at: 0, duration: 72, peak: 318, donations: 27.5, live: true },
          { id: "s2", title: "Tuning Q&A", at: -4, duration: 95, peak: 1240, donations: 184 },
          { id: "s5", title: "Night drift session", at: -11, duration: 128, peak: 960, donations: 96.5 }
        ]
      },
      signals: [
        { kind: "shorts", text: "Shorts are outgrowing long videos over the last 28 days — +38% views against +6%.", href: "analytics-videos-data.html?format=shorts&period=28d" },
        { kind: "upload-day", text: "Over the last 28 days, Saturday uploads got 1.6× the first-day views of weekday uploads.", href: "analytics-videos-data.html?sort=publish_day&period=28d" }
      ]
    },
    hunt: {
      id: "hunt", name: "Hunt Squad", handle: "@huntsquad", initial: "H", color: "var(--color-avatar-4)",
      conn: "link", subs: 52800, videos: 168, connected: -41, updated: -5, network: false,
      niches: ["Co-op shooters"], recentUploads: 12, median7: 21500,
      similar: { d7: { subs: 3.0, views: -2.4, revenue: 1.1, watch: 0.6, avd: -0.8, returning: 0.3 },
        d28: { subs: 5.5, views: 4.0, revenue: 2.7, watch: 3.1, avd: 0.9, returning: 1.2 } },
      sources: { d7: { ads: 112.4, fan: 64, live: 42, network: 0 }, d28: { ads: 451.2, fan: 238, live: 42, network: 0 } },
      suggested: ["squadtactics", "coopnight", "lootrun"],
      summary: {
        d7: { subs: [310, 365], views: [96400, 104900], revenue: [112.4, 121.9] },
        d28: { subs: [1390, 1215], views: [402700, 361300], revenue: [451.2, 430.6] }
      },
      deep: {
        d7: { watch: [5120, 5640], avd: [276, 281], returning: [36.4, 37.1] },
        d28: { watch: [21300, 19900], avd: [280, 274], returning: [36.9, 35.8] }
      },
      month: [362.1, 340.0],
      videos: [
        { id: "v7", title: "This season’s patch in 8 minutes", thumb: "covers/hunt.svg", published: -2, views: 18200, views7: 14100, avd: 251, retention: 44 },
        { id: "v8", title: "Listen for this", thumb: "covers/hunt.svg", published: -6, views: 22900, views7: 19800, avd: 33, retention: 91, short: true },
        { id: "v9", title: "Three of us vs the whole server", thumb: "covers/generic.svg", published: -10, views: 41700, views7: 28600, avd: 318, retention: 47 },
        { id: "v10", title: "Patch day: every change tested", thumb: "covers/hunt.svg", published: -17, views: 88300, views7: 52100, avd: 402, retention: 55 }
      ],
      streams: {
        upcoming: [{ id: "s7", title: "Squad night: new map", at: 3, time: "20:00" }],
        recent: [{ id: "s6", title: "Patch day co-op", at: -6, duration: 154, peak: 410, donations: 42 }]
      },
      signals: [
        { kind: "patch-day", text: "Over the last 28 days, patch-day videos brought 41% of the channel’s views.", href: "analytics-videos-data.html?sort=views&period=28d" }
      ]
    },
    eugene: {
      id: "eugene", name: "Eugene Zemskov", handle: "@eugenezemskov", initial: "E", color: "var(--color-avatar-5)",
      conn: "oauth", subs: 140, videos: 3, connected: -6, updated: null, small: true, network: false,
      niches: ["Sim racing"], recentUploads: 3, median7: 320,
      similar: { d7: { subs: 18.0, views: 21.0, revenue: 0, watch: 9.0, avd: 2.0, returning: 1.0 },
        d28: { subs: 24.0, views: 30.0, revenue: 0, watch: 12.0, avd: 3.0, returning: 1.5 } },
      sources: { d7: { ads: 0, fan: 0, live: 0, network: 0 }, d28: { ads: 0, fan: 0, live: 0, network: 0 } },
      suggested: ["drifthq", "trackdaytv", "simracerdaily"],
      summary: {
        d7: { subs: [12, 4], views: [380, 210], revenue: [0, 0] },
        d28: { subs: [31, 0], views: [1150, 0], revenue: [0, 0] }
      },
      deep: {
        d7: { watch: [9, 4], avd: [86, 71], returning: [12.0, 8.5] },
        d28: { watch: [26, 0], avd: [79, 0], returning: [10.4, 0] }
      },
      month: [0, 0],
      videos: [
        { id: "v11", title: "My first lap on a real track", thumb: "covers/racing.svg", published: -4, views: 610, views7: 410, avd: 94, retention: 38 },
        { id: "v12", title: "Setting up the wheel", thumb: "covers/generic.svg", published: -9, views: 320, views7: 230, avd: 71, retention: 33 },
        { id: "v13", title: "Hello, channel", thumb: "covers/generic.svg", published: -6, views: 220, views7: 180, avd: 22, retention: 64, short: true }
      ],
      streams: { upcoming: [], recent: [] },
      signals: []
    }
  },

  // proven: built from the best videos of the channel and its reference channels
  // trending: built from search trends; volume is web search interest, not YouTube searches
  ideas: [
    { id: "i1", channel: "zems", kind: "proven", format: "video",
      source: { title: "10 cars, 1 lap", channel: "Zems Racing", own: true, thumb: "covers/racing.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("10 cars, 1 lap") },
      title: "Every S1 car in one race — which one actually wins?",
      concept: "All S1-class cars start the same race on the same track; lap times decide the ranking.",
      whyWorked: "“10 cars, 1 lap” got 3.1× your median views; class shootouts on similar channels hold 62% average view duration.",
      whyFits: "Your audience watches long comparisons to the end, and the tuning setups are already in your library." },
    { id: "i2", channel: "zems", kind: "proven", format: "short",
      source: { title: "Fix understeer in one setting", channel: "DriftHQ", own: false, thumb: "covers/speedrun.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("Fix understeer in one setting") },
      title: "The 3-second tune that fixes understeer",
      concept: "One setting, before and after, on the same corner.",
      whyWorked: "Tuning tips are the top Shorts format on 4 of 5 reference channels this month.",
      whyFits: "Your tuning videos get the most saves and comments asking for setups." },
    { id: "i3", channel: "zems", kind: "proven", format: "video",
      source: { title: "Barn find to 600 HP in a week", channel: "Gearhead Garage", own: false, thumb: "covers/generic.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("Barn find to 600 HP in a week") },
      title: "From barn find to a 900 HP drift build",
      concept: "A full restoration and tuning series in one episode, with the cost of every upgrade.",
      whyWorked: "Build videos on reference channels average 2.4× their channel median in the first week.",
      whyFits: "Your drift clips are the most shared Shorts on the channel." },
    { id: "i4", channel: "zems", kind: "proven", format: "short",
      source: { title: "Ranking every car you sent me", channel: "Zems Racing", own: true, thumb: "covers/racing.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("Ranking every car you sent me") },
      title: "Racing the car my subscribers rated worst",
      concept: "Viewers vote in the comments; the losing car gets one honest lap.",
      whyWorked: "Community-picked challenges get 2× the comments of your regular uploads.",
      whyFits: "Your comment section already argues about car rankings every week." },
    { id: "t1", channel: "zems", kind: "trending", format: "video",
      title: "Wet-track racing guide for the winter season",
      concept: "How rain changes braking points and which tunes hold up, with lap-time comparisons.",
      query: "racing game rain setup", volume: 12400, growth: 180, ytDemand: true, competition: "low",
      angle: "Most videos list cars; show lap-time differences on wet tracks with a telemetry overlay." },
    { id: "t2", channel: "zems", kind: "trending", format: "short",
      title: "Which racing wheel is worth it under $300",
      concept: "Three wheels, the same lap, the same driver.",
      query: "budget racing wheel", volume: 9900, growth: 64, ytDemand: true, competition: "high",
      angle: "Competitors review one wheel at a time; compare three on one lap." },
    { id: "t3", channel: "zems", kind: "trending", format: "video",
      title: "A full sim racing setup on a small desk",
      concept: "Building a compact rig step by step, with what to skip when space is tight.",
      query: "small desk sim rig", volume: 4400, growth: 41, ytDemand: false, competition: "medium",
      angle: "Search interest is growing faster than video supply: a clear how-to wins here." },

    { id: "i5", channel: "hunt", kind: "proven", format: "video",
      source: { title: "Loadouts for every role", channel: "Squad Tactics", own: false, thumb: "covers/hunt.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("Loadouts for every role") },
      title: "Three-player loadouts that carry new teammates",
      concept: "One loadout per role, tested in three matches with a new player on the team.",
      whyWorked: "Loadout guides are the best-performing format on 3 of 4 reference channels.",
      whyFits: "Your squad videos already explain roles; this turns them into a reusable guide." },
    { id: "i6", channel: "hunt", kind: "proven", format: "short",
      source: { title: "Listen for this", channel: "Hunt Squad", own: true, thumb: "covers/hunt.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("Listen for this") },
      title: "The sound cue that saves your run",
      concept: "One audio cue, explained in 30 seconds with the clip where it mattered.",
      whyWorked: "Your “listen for this” clip has the best retention on the channel: 91%.",
      whyFits: "Short tactical tips fit the clips you record every session." },
    { id: "i7", channel: "hunt", kind: "proven", format: "video",
      source: { title: "No guns challenge", channel: "Co-op Night", own: false, thumb: "covers/generic.svg", url: "https://www.youtube.com/results?search_query=" + encodeURIComponent("No guns challenge") },
      title: "We tried to win without firing a shot",
      concept: "A full match played on stealth and traps only.",
      whyWorked: "Challenge runs on similar channels hold viewers 40% longer than regular matches.",
      whyFits: "Your audience asks for challenge runs in comments on almost every video." },
    { id: "t4", channel: "hunt", kind: "trending", format: "video",
      title: "This season’s patch explained in 8 minutes",
      concept: "Every change that matters for squads, with clips of each one in a real match.",
      query: "co-op shooter patch notes", volume: 18100, growth: 220, ytDemand: true, competition: "medium",
      angle: "Patch videos read the notes aloud; show each change in gameplay instead." },
    { id: "t5", channel: "hunt", kind: "trending", format: "short",
      title: "The best map to learn on this season",
      concept: "One map, three reasons, one route to start with.",
      query: "best beginner map co-op shooter", volume: 6600, growth: 35, ytDemand: false, competition: "low",
      angle: "Few videos answer this directly; a 40-second answer can rank fast." },
    { id: "t6", channel: "hunt", kind: "trending", format: "video",
      title: "Duo vs trio: which mode pays off this season",
      concept: "The same squad plays both modes for a week and compares results.",
      query: "duo or trio mode", volume: 3600, growth: 28, ytDemand: true, competition: "high",
      angle: "Back the answer with your own week of results, not opinions." },
    { id: "t7", channel: "hunt", kind: "trending", format: "short",
      title: "The headset that lets you hear footsteps first",
      concept: "Three headsets, the same match recording, the same footsteps.",
      query: "best gaming headset footsteps", volume: 8100, growth: 64, ytDemand: true, competition: "medium",
      angle: "Reviews talk about comfort; play the same footstep clip through each headset." }
  ],

  generation: {
    stages: ["analyzing your channel", "finding trends", "writing ideas"],
    runsLeft: 3,
    runsTotal: 5
  },

  // "Happening now": time-bound activity only, a stream on air and donations of the last 24 hours
  now: [
    { channel: "zems", kind: "live", stream: "Forza Chill Ride", title: "“Forza Chill Ride” is live", text: "On air 1h 12m", watching: 274, href: "live-stream.html?id=s1", cta: "Open stream" }
  ],

  // Home ?account=: the prepaid workspace balance and the products behind the metrics strip. default opens with the
  // Wallet section's balance (build-wallet.js) and follows its saved state. lastDonationAt is an offset in days
  accounts: (function () {
    var live2 = [
      { id: "s1", name: "Forza Chill Ride", status: "live", viewersNow: 274 },
      { id: "s2", name: "Night Lo-fi Loop", status: "live", viewersNow: 44 }
    ];
    var down = [
      { id: "s1", name: "Forza Chill Ride", status: "down", offAirSince: "09:42" },
      { id: "s2", name: "Night Lo-fi Loop", status: "live", viewersNow: 44 }
    ];
    var ff = { hasPage: true, everReceived: true, lastDonationAt: 0, donations7d: 184.5, donationsPrev7d: 164.7, memberships: false };
    var noFf = { hasPage: false };
    function acc(o) { return Object.assign({ balance: 12.4, avgDailySpend7d: 2.4, streams: live2, fanFunding: ff, role: "owner" }, o); }
    return {
      "default": acc({}),
      "no-fan-funding": acc({ fanFunding: noFf }),
      "attention": acc({ balance: 4.1, streams: down }),
      "ff-new": acc({ fanFunding: { hasPage: true, everReceived: false, lastDonationAt: null, donations7d: 0, donationsPrev7d: 0, memberships: false } }),
      "ff-quiet": acc({ fanFunding: { hasPage: true, everReceived: true, lastDonationAt: 12, donations7d: 0, donationsPrev7d: 0, memberships: false } }),
      "analytics-only": acc({ balance: 3, avgDailySpend7d: 0.2, streams: [], fanFunding: noFf }),
      "member": acc({ role: "user" })
    };
  })(),

  // Home → Needs attention: blockers with one action each
  attention: {
    "views-hunt": { channel: "hunt", kind: "views-drop", title: "Views on Hunt Squad’s last two uploads are 42% below the channel median",
      text: "Both were published in the last 7 days.", cta: "See videos", href: "dashboard-channel.html?id=hunt#videos" },
    "payout-method": { kind: "payout-method", title: "Add a payout method to receive your balance",
      text: "Payouts start once a payout method is added.", cta: "Add payout method", href: "wallet-methods.html" },
    "google-expired": { channel: "zems", kind: "google-expired", title: "Reconnect Zems Racing to keep revenue up to date",
      text: "Google access expired, so revenue and retention stopped updating.", cta: "Reconnect", google: "zems" },
    "payout-failed": { kind: "payout-failed", title: "Your $1,250.00 payout did not go through",
      text: "The bank returned the transfer. Check the payout method details.", cta: "Check payout method", href: "wallet-methods.html" },
    "stream-blocked": { channel: "zems", kind: "stream-blocked", title: "YouTube blocked “Sunday endurance” from going live",
      text: "The stream title was flagged. Edit it before the scheduled start.", cta: "Edit stream", href: "live-stream.html?id=s3" }
  },

  // Home → Trending now: market trends, not personalised. A trend targets the channels whose niches include it;
  // ideas holds the idea "Make an idea" produces for each channel
  trends: [
    { id: "trend-rain", topic: "Wet-track setups in racing games", niche: "Sim racing", growth: 180, days: 4, ideas: { zems: "t1", eugene: "t1" } },
    { id: "trend-patch", topic: "Patch breakdowns for co-op shooters", niche: "Co-op shooters", growth: 220, days: 2, ideas: { hunt: "t4" } },
    { id: "trend-gear", topic: "Gaming gear under $300", niche: "Gaming hardware", growth: 64, days: 6, ideas: { zems: "t2", hunt: "t7", eugene: "t2" } },
    { id: "trend-desk", topic: "Compact sim rigs for small rooms", niche: "Sim racing", growth: 95, days: 9, ideas: { zems: "t3" } },
    { id: "trend-maps", topic: "Beginner map guides for the new season", niche: "Co-op shooters", growth: 120, days: 5, ideas: { hunt: "t5" } },
    { id: "trend-duo", topic: "Duo versus trio squad debates", niche: "Co-op shooters", growth: 48, days: 11, ideas: { hunt: "t6" } }
  ],

  // Home rail → Statuses: pending application and review states; a resolved state shows its outcome once
  statuses: [
    { id: "status-network", title: "Network application for Hunt Squad", text: "Sent 5 days ago. Reviews take up to 10 business days.", href: "#",
      outcomes: {
        approved: { text: "Hunt Squad joins the Network on the 1st of next month.", tone: "ok", tag: "Approved" },
        declined: { text: "Hunt Squad needs 90 days of channel history. You can apply again in 3 weeks.", tone: "bad", tag: "Declined" }
      } }
  ],

  // Home rail → Suggested for you: product prompts that are not AI content
  suggestions: [
    { id: "suggest-channel", title: "Connect a second channel", text: "Track both channels on Dashboard and get ideas for each.", cta: "Connect channel", connect: true, single: true },
    { id: "suggest-ff-page", title: "Create your Fan Funding page", text: "Let viewers support you with one-off donations and memberships.", cta: "Create page", href: "fan-funding.html", ffNoPage: true },
    { id: "suggest-memberships", ffNoMemberships: true, title: "Turn on memberships", text: "Give regular viewers a monthly way to support the channel.", cta: "Set up", href: "#" },
    { id: "suggest-schedule", title: "Schedule your next stream", text: "Viewers get a reminder when a stream is on the calendar.", cta: "Open calendar", href: "live-calendar.html" }
  ],

  // Ideas page: the search history. A search covers one or more channels (connected ones by id, others by their
  // directory handle) and has an optional name; created is an offset in days. Each idea is written for one of the
  // search's channels (for). Idea state: saved, hidden with an optional reason. An idea with from copies that proven idea
  ideaRuns: {
    stages: ["studying the channel", "finding similar videos", "writing ideas"],
    locale: { zems: ["United States", "English"], hunt: ["United Kingdom", "English"], eugene: ["Ukraine", "Ukrainian"] },
    regions: ["United States", "United Kingdom", "Canada", "Germany", "Ukraine", "Worldwide"],
    languages: ["English", "German", "Spanish", "Ukrainian"],
    runs: [
      { id: "hunt-2", name: "Patch week", channels: ["hunt"], formats: ["video", "short"],
        region: "United Kingdom", language: "English", context: "", created: 0, status: "running", stage: 2, ideas: [] },
      { id: "eugene-1", name: "", channels: ["eugene"], formats: ["video", "short"],
        region: "Ukraine", language: "Ukrainian", context: "First videos for a new channel.", created: -1, status: "failed", stage: 1, ideas: [] },
      { id: "driftking-1", name: "Drift King teardown", channels: ["driftking"], formats: ["video", "short"],
        region: "United States", language: "English", context: "Drift only. More Shorts, fewer long builds.", created: -3, status: "done", unseen: true,
        ideas: ["d1", "d2", "d3", "d4", "d5"] },
      { id: "zems-2", name: "Winter content plan", channels: ["zems", "hunt"], formats: ["video", "short"],
        region: "United States", language: "English", context: "Moving from car reviews to tuning guides. No crash compilations.", created: -5, status: "done",
        ideas: ["i1", "i2", "i3", "i4", "z5", "z6", "z7", "z8", "h1", "h2"] },
      { id: "hunt-1", name: "Co-op challenges", channels: ["hunt"], formats: ["video", "short"],
        region: "United Kingdom", language: "English", context: "", created: -8, status: "done", ideas: ["i5", "i6", "i7"] },
      { id: "zems-1", name: "", channels: ["zems"], formats: ["video"],
        region: "United States", language: "English", context: "", created: -12, status: "done", ideas: ["y1", "y2", "y3", "y4"] }
    ],
    ideas: [
      { id: "i1", from: "i1", state: "saved" },
      { id: "i2", from: "i2" },
      { id: "i3", from: "i3" },
      { id: "i4", from: "i4", state: "hidden", reason: "Already made it" },
      { id: "z5", for: "zems", format: "video", title: "Grip, drift and drag: one car, three tunes",
        concept: "The same car tuned three ways and run on three tracks; the stopwatch picks the best build.",
        source: { title: "One car, three builds", channel: "Trackday TV", thumb: "covers/racing.svg" },
        whyWorked: "Three-way build videos on Trackday TV averaged 2.8× the channel median in their first week.",
        whyFits: "Your tuning guides keep viewers past the eight-minute mark." },
      { id: "z6", for: "zems", format: "short", state: "saved", title: "Brake ten metres later on this corner",
        concept: "One corner, one braking marker, before and after lap times.",
        source: { title: "The late-brake trick", channel: "Sim Racer Daily", thumb: "covers/speedrun.svg" },
        whyWorked: "Single-corner tips are the most replayed Shorts on Sim Racer Daily this month.",
        whyFits: "Viewers ask for braking points in the comments of every track video." },
      { id: "z7", for: "zems", format: "video", title: "My subscribers tuned my car for a week",
        concept: "Each day the top comment sets one tuning value; the last video races the result.",
        source: { title: "Ranking every car you sent me", channel: "Zems Racing", own: true, thumb: "covers/generic.svg" },
        whyWorked: "Your community-picked video got 2× the comments of a regular upload.",
        whyFits: "The channel is moving to tuning guides, and this puts the audience in the tuning." },
      { id: "z8", for: "zems", format: "short", title: "The setting nobody touches that wins races",
        concept: "One overlooked setting, two laps, the difference on screen.",
        source: { title: "Fix understeer with one setting", channel: "Zems Racing", own: true, thumb: "covers/speedrun.svg" },
        whyWorked: "“Fix understeer with one setting” held 87% of viewers to the end.",
        whyFits: "One-setting Shorts are the format your audience saves most." },
      { id: "y1", for: "zems", format: "video", state: "saved", title: "Five weather settings, one car, one lap",
        concept: "The same lap in dry, light rain, heavy rain, fog and night, with the time lost in each.",
        source: { title: "Night drift on the new map", channel: "Zems Racing", own: true, thumb: "covers/racing.svg" },
        whyWorked: "Condition comparisons kept 46% of viewers to the end on your night drift video.",
        whyFits: "Weather setups are the most asked-about topic in your comments." },
      { id: "y2", for: "zems", format: "video", title: "What a $50 upgrade does to lap times",
        concept: "Three cheap upgrades, one track, a lap time after each.",
        source: { title: "Wheel or controller: 30 laps each", channel: "Zems Racing", own: true, thumb: "covers/speedrun.svg" },
        whyWorked: "Budget comparisons on your channel hold viewers 20% longer than reviews.",
        whyFits: "Most of your audience plays on entry-level gear." },
      { id: "y3", for: "zems", format: "video", title: "Rebuilding my first tune, three years later",
        concept: "The first setup from the channel next to a new one, explained change by change.",
        source: { title: "10 cars, 1 lap: the S1 shootout", channel: "Zems Racing", own: true, thumb: "covers/racing.svg" },
        whyWorked: "Long comparisons are your best-performing format over the last 90 days.",
        whyFits: "Long-time subscribers remember the early videos and comment on them." },
      { id: "y4", for: "zems", format: "video", title: "Every pit lane mistake I made this season",
        concept: "A countdown of pit errors with the time each one cost.",
        source: { title: "The 4-second pit stop", channel: "Zems Racing", own: true, thumb: "covers/racing.svg" },
        whyWorked: "“The 4-second pit stop” is your most viewed Short.",
        whyFits: "A long version answers the questions the Short left in the comments." },
      { id: "d1", for: "driftking", format: "short", title: "The one-handbrake entry every drifter skips",
        concept: "One entry technique, slowed down, then at full speed.",
        source: { title: "Handbrake entries explained", channel: "DriftHQ", thumb: "covers/racing.svg" },
        whyWorked: "Technique Shorts on DriftHQ averaged 3.4× its median views this month.",
        whyFits: "Your best Shorts are slow-motion breakdowns of a single move." },
      { id: "d2", for: "driftking", format: "short", title: "Drift score: what the judges actually look at",
        concept: "Three runs scored side by side with the judging points on screen.",
        source: { title: "Judged runs, explained", channel: "DriftHQ", thumb: "covers/speedrun.svg" },
        whyWorked: "Scoring explainers on DriftHQ get twice the shares of its regular uploads.",
        whyFits: "Your audience argues about scores under every competition clip." },
      { id: "d3", for: "driftking", format: "video", title: "Building a drift car on a $2,000 budget",
        concept: "Every part and its price, from a stock car to its first track day.",
        source: { title: "Cheapest drift build", channel: "Drift King", own: true, thumb: "covers/generic.svg" },
        whyWorked: "“Cheapest drift build” is the most watched video on the channel.",
        whyFits: "Budget builds bring new viewers who then watch the Shorts." },
      { id: "d4", for: "driftking", format: "short", title: "Tandem drifting with a stranger for the first time",
        concept: "One tandem run with someone met at the track, cut to 40 seconds.",
        source: { title: "Tandem with my brother", channel: "Drift King", own: true, thumb: "covers/racing.svg" },
        whyWorked: "Tandem Shorts on the channel hold 88% of viewers.",
        whyFits: "Track-day footage is already recorded every weekend." },
      { id: "d5", for: "driftking", format: "short", title: "Why your drift car spins on exit",
        concept: "The three exit mistakes, each shown once and fixed once.",
        source: { title: "Fix your exits", channel: "DriftHQ", thumb: "covers/speedrun.svg" },
        whyWorked: "Fix-it Shorts are the top format on DriftHQ this season.",
        whyFits: "Your viewers are learning to drift, and exits are their most common question." },
      { id: "h1", for: "hunt", format: "video", state: "saved", title: "Every patch change tested in one squad match",
        concept: "One match per change, played the day the patch lands, with the result on screen.",
        source: { title: "Patch day: every change tested", channel: "Hunt Squad", own: true, thumb: "covers/hunt.svg" },
        whyWorked: "“Patch day: every change tested” brought 4× your median views in its first week.",
        whyFits: "Patch days are when your audience searches for the channel most." },
      { id: "h2", for: "hunt", format: "short", title: "The one setting every new squad member gets wrong",
        concept: "One setting, shown wrong then right, in 30 seconds.",
        source: { title: "Loadouts for every role", channel: "Squad Tactics", thumb: "covers/hunt.svg" },
        whyWorked: "Setup Shorts on Squad Tactics average 3× its median views.",
        whyFits: "New players ask about settings under almost every squad video." },
      { id: "i5", from: "i5", state: "hidden", reason: "Too competitive" },
      { id: "i6", from: "i6", state: "hidden", reason: "Wrong format" },
      { id: "i7", from: "i7", state: "hidden" }
    ]
  },

  dislikeReasons: ["Not my topic", "Already made it", "Too competitive", "Wrong format"],

  // known channels: a pasted link resolves to its avatar and name; the suggestions come from
  // the same source as Find similar channels in Analytics
  directory: {
    drifthq: { name: "DriftHQ", initial: "D", color: "var(--color-avatar-1)" },
    simracerdaily: { name: "Sim Racer Daily", initial: "S", color: "var(--color-avatar-3)" },
    trackdaytv: { name: "Trackday TV", initial: "T", color: "var(--color-avatar-6)" },
    gearheadgarage: { name: "Gearhead Garage", initial: "G", color: "var(--color-avatar-0)" },
    squadtactics: { name: "Squad Tactics", initial: "S", color: "var(--color-avatar-1)" },
    coopnight: { name: "Co-op Night", initial: "C", color: "var(--color-avatar-3)" },
    lootrun: { name: "Loot Run", initial: "L", color: "var(--color-avatar-6)" },
    driftking: { name: "Drift King", initial: "D", color: "var(--color-avatar-5)" }
  },
  dialogInvalid: ["youtube.com/@drifthq", "youtube.com/watch?v=Xb7k2pQ"]
};

(function (F) {
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    return function () {
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // n points from the previous-period level to the current one; the noise and the curve differ per key
  function series(key, n, cur, prev) {
    var r = rng(hash(key)), dir = cur > prev ? 1 : cur < prev ? -1 : 0, shape = r(), out = [], walk = 0;
    var base = Math.max(Math.abs(cur), Math.abs(prev), 1) / n, rise = 0.35 + r() * 0.25;
    for (var i = 0; i < n; i++) {
      var p = i / (n - 1), curve = shape < 0.33 ? p : shape < 0.66 ? p * p : Math.sqrt(p);
      walk += (r() - 0.5) * 0.22;
      var noise = i === 0 || i === n - 1 ? 0 : walk + (r() - 0.5) * 0.12;
      out.push(Math.round(base * (1 + dir * rise * curve + noise) * 100) / 100);
    }
    return out;
  }
  Object.keys(F.channels).forEach(function (id) {
    var c = F.channels[id];
    ["d7", "d28"].forEach(function (per) {
      var n = per === "d7" ? 7 : 14, s = c.summary[per], d = c.deep[per];
      s.spark = {}; d.spark = {};
      ["subs", "views", "revenue"].forEach(function (m) { s.spark[m] = series(id + per + m, n, s[m][0], s[m][1]); });
      ["watch", "avd", "returning"].forEach(function (m) { d.spark[m] = series(id + per + m, n, d[m][0], d[m][1]); });
    });
  });
})(window.V2_FIXTURES);
