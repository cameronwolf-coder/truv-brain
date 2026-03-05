// Pipedream Step: filter_events
// Filters SendGrid webhook event array to loggable types and deduplicates

export default defineComponent({
  async run({ steps, $ }) {
    // SendGrid sends events as an array
    const events = steps.trigger.event.body;

    if (!Array.isArray(events) || events.length === 0) {
      $.flow.exit("No events in payload");
    }

    const LOGGABLE_EVENTS = ["delivered", "open", "click", "bounce", "dropped", "unsubscribe"];

    const STATUS_MAP = {
      delivered: "SENT",
      open: "SENT",
      click: "SENT",
      bounce: "BOUNCED",
      dropped: "FAILED",
      unsubscribe: "SENT",
    };

    const parsed = events
      .filter(e => LOGGABLE_EVENTS.includes(e.event))
      .map(e => ({
        email: e.email,
        event: e.event,
        timestamp: new Date(e.timestamp * 1000).toISOString(),
        sg_message_id: e.sg_message_id?.split(".")[0] || "",
        subject: e.subject || "Email from Truv",
        category: Array.isArray(e.category) ? e.category.join(", ") : (e.category || "Marketing"),
        status: STATUS_MAP[e.event] || "SENT",
        url: e.url || null,
      }));

    if (parsed.length === 0) {
      $.flow.exit("No loggable events");
    }

    // Prioritize delivery events; deduplicate by email + message ID
    const deliveryEvents = parsed.filter(e => e.event === "delivered");
    const otherEvents = parsed.filter(e => e.event !== "delivered");
    const toProcess = deliveryEvents.length > 0 ? deliveryEvents : otherEvents;

    const seen = new Set();
    const unique = toProcess.filter(e => {
      const key = `${e.email}:${e.sg_message_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { events: unique, count: unique.length };
  },
});
