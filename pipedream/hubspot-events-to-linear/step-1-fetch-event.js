// Pipedream Step: fetch_event_details
// Fetches full HubSpot Event record by objectId from webhook payload
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
    const payload = steps.trigger.event.body || steps.trigger.event;

    const objectId = payload.objectId
      || payload.properties?.hs_object_id
      || payload.hs_object_id;

    if (!objectId) {
      $.flow.exit("No objectId found in webhook payload");
    }

    const response = await axios($, {
      method: "GET",
      url: `https://api.hubapi.com/crm/v3/objects/2-56342751/${objectId}`,
      headers: {
        Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`
      },
      params: {
        properties: [
          "event_name",
          "event_start_date",
          "event_end_date",
          "event_location",
          "event_url",
          "event_status",
          "event_type",
          "hubspot_owner_id"
        ].join(",")
      }
    });

    const props = response.properties || {};

    return {
      id: response.id,
      name: props.event_name || "Untitled Event",
      startDate: props.event_start_date || null,
      endDate: props.event_end_date || null,
      location: props.event_location || "",
      url: props.event_url || "",
      status: props.event_status || "Upcoming",
      type: props.event_type || "Conference",
      ownerId: props.hubspot_owner_id || null
    };
  }
});
