// Pipedream Step: fetch_hubspot_subscribers
// Paginates HubSpot list 1799 (Changelog Subscribers) for email + name
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
    const listId = "1799";
    let contacts = [];
    let hasMore = true;
    let offset = 0;

    while (hasMore) {
      const response = await axios($, {
        method: "GET",
        url: `https://api.hubapi.com/contacts/v1/lists/${listId}/contacts/all`,
        headers: {
          Authorization: `Bearer ${this.hubspot.$auth.oauth_access_token}`
        },
        params: {
          count: 100,
          vidOffset: offset,
          property: ["email", "firstname"]
        }
      });

      const batch = (response.contacts || []).map(c => ({
        email: c.properties?.email?.value || c["identity-profiles"]?.[0]?.identities?.find(i => i.type === "EMAIL")?.value,
        name: c.properties?.firstname?.value || "there"
      })).filter(c => c.email);

      contacts = contacts.concat(batch);
      hasMore = response["has-more"] || false;
      offset = response["vid-offset"] || 0;
    }

    return { contacts, count: contacts.length };
  }
});
