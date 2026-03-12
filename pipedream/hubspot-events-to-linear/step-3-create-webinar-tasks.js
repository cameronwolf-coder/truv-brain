// Pipedream Step: create_webinar_tasks
// Creates HubSpot tasks from the Webinar Event Marketing Playbook
// Only runs when event_type === "Webinar"
// Tasks get auto-calculated due dates relative to event_start_date
// Requires: HubSpot app connected

import { axios } from "@pipedream/platform";

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot"
    }
  },
  async run({ steps, $ }) {
    const event = steps.code.$return_value;

    // Only create tasks for webinars
    if (event.type !== "Webinar") {
      $.flow.exit(`Skipping task creation - event type is "${event.type}", not "Webinar"`);
    }

    if (!event.startDate) {
      $.flow.exit("No event_start_date set - cannot calculate task due dates");
    }

    const eventDate = new Date(event.startDate + "T00:00:00");
    const eventId = event.id;

    // ── Role-based owner mapping ──────────────────────────────────
    const OWNERS = {
      MARKETING_OPS: "82949240",    // Cam Wolf
      EVENT_MARKETING: "84510183",  // Melissa Hausser
      PRODUCT_MARKETING: "434899562", // Kaytren Bruner
      SALES: null                   // Unassigned - Sales leadership routes
    };

    // ── Playbook task definitions ─────────────────────────────────
    // offset: days relative to event start (negative = before, positive = after)
    // owner: role key from OWNERS map
    // priority: HIGH or MEDIUM
    const PLAYBOOK_TASKS = [
      // ── Setup & Strategy (T-8 to T-6 weeks) ──
      {
        subject: "Confirm webinar objective (Demand Gen / Pipeline Accel / Customer)",
        body: "Declare the primary business objective before promotion begins. Define target registrations, attendance rate, and meetings/pipeline influenced.",
        offset: -56,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Confirm ICP definition and priority personas",
        body: "Define target personas (VP+ titles, decision-makers, economic influencers). Document % customers vs prospects, % open pipeline vs net-new, % ICP vs non-ICP.",
        offset: -56,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Lock target account strategy (named vs. broad ICP)",
        body: "Executive webinars should default to named-account targeting rather than broad list sends.",
        offset: -56,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Confirm speakers (internal + customer/partner)",
        body: "Lock primary speaker at least 4 weeks prior. Late confirmation materially increases execution risk and content instability.",
        offset: -49,
        owner: "EVENT_MARKETING",
        priority: "HIGH"
      },
      {
        subject: "Align on core proof point and primary narrative",
        body: "Define one primary outcome promise, one quantified proof point, and one explicit objection to address.",
        offset: -49,
        owner: "PRODUCT_MARKETING",
        priority: "MEDIUM"
      },
      {
        subject: "Draft high-level run of show",
        body: "Outline the webinar flow: introductions, speaker segments, Q&A, polls, and CTA.",
        offset: -49,
        owner: "EVENT_MARKETING",
        priority: "MEDIUM"
      },
      {
        subject: "Finalize title, abstract, and agenda",
        body: "Lock the webinar title and description for use across all channels.",
        offset: -42,
        owner: "PRODUCT_MARKETING",
        priority: "MEDIUM"
      },
      {
        subject: "Approve webinar format (fireside, case study, panel)",
        body: "Confirm format and get alignment from all stakeholders.",
        offset: -42,
        owner: "EVENT_MARKETING",
        priority: "MEDIUM"
      },
      {
        subject: "Create project plan and owner map by function",
        body: "Document ownership for Marketing Ops, Event Marketing, Product Marketing, and Sales. Prevents last-minute scope bleed.",
        offset: -42,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },

      // ── Build - Systems (T-4 weeks) ──
      {
        subject: "Finalize audience segments in HubSpot",
        body: "Create audience lists. Exclude non-ICP groups (dashboard users, disqualified contacts). All build work must be complete before outreach begins.",
        offset: -28,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },
      {
        subject: "Create Clay registrant table schema",
        body: "Set up Clay table to track Registrants > Attendees > No-Shows with HubSpot sync.",
        offset: -28,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Confirm email/Knock/Wrapper/SendGrid readiness",
        body: "Validate sending domain/IP readiness, Knock publishing permissions, Wrapper sync viability, unsubscribe and GDPR/CCPA compliance paths.",
        offset: -28,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },

      // ── Build - Content (T-4 weeks) ──
      {
        subject: "Draft email copy by audience tier",
        body: "Write email copy for awareness, relevance, commitment, and attendance stages. Messaging must be locked before HTML and workflows are built.",
        offset: -28,
        owner: "PRODUCT_MARKETING",
        priority: "MEDIUM"
      },
      {
        subject: "Draft LinkedIn copy (organic + paid if applicable)",
        body: "Create copy for 4-6 LinkedIn posts across the promotion timeline. Include speaker POV, stat teasers, and final reminders.",
        offset: -28,
        owner: "PRODUCT_MARKETING",
        priority: "MEDIUM"
      },

      // ── Build - Templates & Automation (T-3 weeks) ──
      {
        subject: "Build HTML email templates in Knock",
        body: "Production-ready templates: accessible, mobile responsive, deliverability-safe. Create Knock workflows for announcement, reminder(s), and day-of send.",
        offset: -21,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },
      {
        subject: "Configure Knock / Wrapper triggers and dry-run QA",
        body: "Set up drip logic and deadline-based sends. Perform dry-run: template rendering, workflow routing, suppression logic, Wrapper control.",
        offset: -21,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },

      // ── Promotion (T-3 weeks to T-3 days) ──
      {
        subject: "Launch awareness email (non-urgent)",
        body: "First email to target audience. Early, relevance-led outreach protects list health and establishes intent.",
        offset: -21,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Publish first LinkedIn post (speaker POV)",
        body: "First organic LinkedIn post. Speaker/partner outreach begins.",
        offset: -21,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Send follow-up email to warm audiences",
        body: "Target prior form-fillers and qualified prospects. Higher-quality registrations come from warm cohorts.",
        offset: -14,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Sales: manually invite Tier-1 target accounts",
        body: "AEs manually invite priority target accounts. Personalized outreach aligned to webinar timeline.",
        offset: -14,
        owner: "SALES",
        priority: "HIGH"
      },
      {
        subject: "Commitment-focused email to non-registrants",
        body: "Late-cycle outreach should optimize for conversion, not reach. Optional SDR nudges for top accounts.",
        offset: -7,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Final organic LinkedIn post",
        body: "Last LinkedIn push before the event.",
        offset: -7,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Stop prospecting - shift to attendance enablement",
        body: "No more prospecting emails. Focus on reminders and attendance enablement only. Continuing too close to the event increases unsubscribes.",
        offset: -3,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },

      // ── Event Day (T-0) ──
      {
        subject: "Final LinkedIn reminder + technical check",
        body: "Morning: post final LinkedIn reminder. T-60 min: full technical check (platform, recording, polls). T-15 min: host and speakers join, mic/screen checks.",
        offset: 0,
        owner: "EVENT_MARKETING",
        priority: "HIGH"
      },

      // ── Post-Event (T+1 to T+14) ──
      {
        subject: "Export attendance data and create Clay tables",
        body: "Export attendance and engagement data. Create Clay tables for Attendees and No-Shows. Match to HubSpot ownership.",
        offset: 1,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },
      {
        subject: "Sales: assign owners to 100% of attendees",
        body: "Route high-engagement attendees to AEs. Existing CRM owner retains ownership. Unowned leads auto-assigned via routing rules. First-touch SLA: <24 hours for attendees.",
        offset: 1,
        owner: "SALES",
        priority: "HIGH"
      },
      {
        subject: "Edit webinar recording and upload to YouTube",
        body: "Download raw recording. Edit within 24 hours (remove dead air, improve audio, add captions). Upload to YouTube within 48 hours.",
        offset: 2,
        owner: "MARKETING_OPS",
        priority: "HIGH"
      },
      {
        subject: "Sales: personalized follow-up to attendees",
        body: "Manual, personalized outreach referencing the webinar. No automated sequences. Acceptable paths: personalized email, LinkedIn message, or phone + follow-up email.",
        offset: 2,
        owner: "SALES",
        priority: "HIGH"
      },
      {
        subject: "Create short-form social clips",
        body: "Produce 3-6 clips for LinkedIn, YouTube Shorts, and Meta. Webinar content loses distribution value after 72 hours if not activated.",
        offset: 3,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Review meetings booked by engagement tier - validate SLA",
        body: "Check % attendees contacted within 24h, meetings booked, and coverage (% registrants touched). Flag SLA misses.",
        offset: 7,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      },
      {
        subject: "Snapshot pipeline influenced - complete post-mortem",
        body: "Document pipeline influenced by the webinar. Complete standardized post-mortem using the Webinar Event Marketing Playbook.",
        offset: 14,
        owner: "MARKETING_OPS",
        priority: "MEDIUM"
      }
    ];

    // ── Helper: calculate due date ────────────────────────────────
    function calcDueDate(offsetDays) {
      const due = new Date(eventDate);
      due.setDate(due.getDate() + offsetDays);
      return due.getTime(); // Unix ms for hs_timestamp
    }

    // ── Helper: create a single task ──────────────────────────────
    const createTask = async (task) => {
      const properties = {
        hs_task_subject: `[${event.name}] ${task.subject}`,
        hs_task_body: task.body,
        hs_timestamp: String(calcDueDate(task.offset)),
        hs_task_status: "NOT_STARTED",
        hs_task_priority: task.priority,
        hs_task_type: "TODO"
      };

      const ownerId = OWNERS[task.owner];
      if (ownerId) {
        properties.hubspot_owner_id = ownerId;
      }

      const res = await axios($, {
        method: "POST",
        url: "https://api.hubapi.com/crm/v3/objects/tasks",
        headers: {
          Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
          "Content-Type": "application/json"
        },
        data: { properties }
      });

      return res.id;
    }

    // ── Helper: associate task with Event ──────────────────────────
    const associateTaskToEvent = async (taskId) => {
      await axios($, {
        method: "PUT",
        url: `https://api.hubapi.com/crm/v4/objects/tasks/${taskId}/associations/default/2-56342751/${eventId}`,
        headers: {
          Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`,
          "Content-Type": "application/json"
        }
      });
    }

    // ── Create all tasks ──────────────────────────────────────────
    const results = [];
    for (const task of PLAYBOOK_TASKS) {
      try {
        const taskId = await createTask(task);
        await associateTaskToEvent(taskId);
        results.push({
          id: taskId,
          subject: task.subject,
          body: task.body,
          dueDate: new Date(calcDueDate(task.offset)).toISOString().split("T")[0],
          offset: task.offset,
          owner: task.owner,
          priority: task.priority,
          status: "created"
        });
      } catch (err) {
        results.push({
          subject: task.subject,
          status: "failed",
          error: err.message || String(err)
        });
      }
    }

    const created = results.filter(r => r.status === "created");
    const failed = results.filter(r => r.status === "failed");

    return {
      event: event.name,
      eventDate: event.startDate,
      totalTasks: PLAYBOOK_TASKS.length,
      created: created.length,
      failed: failed.length,
      tasks: created,
      failedTasks: failed,
      firstDueDate: new Date(calcDueDate(Math.min(...PLAYBOOK_TASKS.map(t => t.offset)))).toISOString().split("T")[0],
      lastDueDate: new Date(calcDueDate(Math.max(...PLAYBOOK_TASKS.map(t => t.offset)))).toISOString().split("T")[0]
    };
  }
});
