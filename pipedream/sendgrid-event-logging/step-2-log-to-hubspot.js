// Pipedream Step: log_to_hubspot
// Copy this entire file into the Pipedream code step
// Requires: HubSpot app connected as "hubspot"

import axios from "axios"

export default defineComponent({
  props: {
    hubspot: {
      type: "app",
      app: "hubspot",
    },
  },
  async run({ steps, $ }) {
    const events = steps.filter_events.$return_value?.events || [];
    if (!events || events.length === 0) {
      $.flow.exit("No events to process");
    }

    const token = this.hubspot.$auth.oauth_access_token;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    const results = [];

    // Events that create a new email engagement
    const CREATE_EVENTS = new Set(["delivered", "bounce", "dropped", "unsubscribe"]);
    // Events that update contact properties + find/create engagement
    const UPDATE_EVENTS = new Set(["open", "click"]);

    // Build HTML table body for HubSpot email engagement
    function buildEmailHtml(rows, sgMessageId) {
      const tableRows = rows
        .map(([label, value]) => `<tr><td style="padding:4px 8px;font-weight:bold;">${label}</td><td style="padding:4px 8px;">${value}</td></tr>`)
        .join("");
      let html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;"><table style="border-collapse:collapse;width:100%;"><tbody>${tableRows}</tbody></table>`;
      if (sgMessageId) {
        html += `<br><strong>Links:</strong><br><a href="https://app.sendgrid.com/email_activity?msg_id=${sgMessageId}">SendGrid Activity</a>`;
      }
      html += `</div>`;
      return html;
    }

    function buildEmailText(rows, sgMessageId) {
      return rows.map(([label, value]) => `${label}: ${value}`).join(" | ") + (sgMessageId ? ` | Message ID: ${sgMessageId}` : "");
    }

    for (const event of events) {
      try {
        // 1. Search for contact by email
        const searchRes = await axios.post(
          "https://api.hubapi.com/crm/v3/objects/contacts/search",
          {
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: event.email }] }],
            properties: ["firstname", "lastname", "email", "sg_first_email_open_date", "sg_first_email_click_date"],
            limit: 1,
          },
          { headers }
        );

        const contact = searchRes.data?.results?.[0];
        if (!contact) {
          results.push({ email: event.email, status: "skipped", reason: "Contact not found" });
          continue;
        }

        // 2a. For open/click events — update contact properties + find/create engagement
        if (UPDATE_EVENTS.has(event.event)) {
          // Update contact date properties
          if (event.event === "open") {
            const contactUpdates = { sg_last_email_open_date: event.timestamp };
            if (!contact.properties?.sg_first_email_open_date) {
              contactUpdates.sg_first_email_open_date = event.timestamp;
            }
            await axios.patch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`,
              { properties: contactUpdates },
              { headers }
            );
          }

          if (event.event === "click") {
            const contactUpdates = { sg_last_email_click_date: event.timestamp };
            if (!contact.properties?.sg_first_email_click_date) {
              contactUpdates.sg_first_email_click_date = event.timestamp;
            }
            await axios.patch(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`,
              { properties: contactUpdates },
              { headers }
            );
          }

          // Search for existing email engagement on this contact with matching message ID
          let existingEmailId = null;
          if (event.sg_message_id) {
            const assocRes = await axios.get(
              `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}/associations/emails`,
              { headers }
            );
            const emailIds = (assocRes.data?.results || []).map(r => r.id);

            // Check recent emails (last 10) for matching message ID in body
            for (const eid of emailIds.slice(-10)) {
              const emailObj = await axios.get(
                `https://api.hubapi.com/crm/v3/objects/emails/${eid}?properties=hs_email_text`,
                { headers }
              );
              const body = emailObj.data?.properties?.hs_email_text || "";
              if (body.includes(event.sg_message_id)) {
                existingEmailId = eid;
                break;
              }
            }
          }

          const trackDate = new Date(event.timestamp).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"
          });
          const trackLabel = event.event === "open" ? "Opened" : "Clicked";
          const trackValue = event.event === "open" ? trackDate : `${event.url || "link"} — ${trackDate}`;

          if (existingEmailId) {
            // Update existing engagement — append tracking row to HTML and text
            const emailObj = await axios.get(
              `https://api.hubapi.com/crm/v3/objects/emails/${existingEmailId}?properties=hs_email_html,hs_email_text`,
              { headers }
            );
            const currentHtml = emailObj.data?.properties?.hs_email_html || "";
            const currentText = emailObj.data?.properties?.hs_email_text || "";

            const newRow = `<tr><td style="padding:4px 8px;font-weight:bold;">${trackLabel}</td><td style="padding:4px 8px;">${trackValue}</td></tr>`;
            // Insert new row before </tbody>
            const updatedHtml = currentHtml.replace("</tbody>", newRow + "</tbody>");
            const updatedText = currentText + ` | ${trackLabel}: ${trackValue}`;

            await axios.patch(
              `https://api.hubapi.com/crm/v3/objects/emails/${existingEmailId}`,
              { properties: { hs_email_html: updatedHtml, hs_email_text: updatedText } },
              { headers }
            );
            results.push({ email: event.email, contactId: contact.id, engagementId: existingEmailId, event: event.event, status: "updated" });
          } else {
            // Backfill: create the email engagement since delivered was missed
            const category = event.category || "Marketing";
            const rawSubject = event.subject || "";
            let emailSubject;
            if (rawSubject && rawSubject !== "Email from Truv" && rawSubject !== "") {
              emailSubject = rawSubject;
            } else {
              emailSubject = `Truv Marketing Email — ${category}`;
            }

            const rows = [
              ["Status", "Delivered"],
              ["Campaign", category],
              ["Sent", trackDate],
              ["Channel", "SendGrid"],
              [trackLabel, trackValue],
            ];

            const emailRes = await axios.post(
              "https://api.hubapi.com/crm/v3/objects/emails",
              {
                properties: {
                  hs_timestamp: event.timestamp,
                  hs_email_direction: "EMAIL",
                  hs_email_status: "SENT",
                  hs_email_subject: emailSubject,
                  hs_email_html: buildEmailHtml(rows, event.sg_message_id),
                  hs_email_text: buildEmailText(rows, event.sg_message_id),
                  hs_email_headers: JSON.stringify({
                    from: { email: "insights@email.truv.com", firstName: "Truv", lastName: "Marketing" },
                    to: [{ email: event.email, firstName: contact.properties?.firstname || "", lastName: contact.properties?.lastname || "" }],
                  }),
                },
              },
              { headers }
            );

            await axios.post(
              "https://api.hubapi.com/crm/v3/associations/emails/contacts/batch/create",
              {
                inputs: [{ from: { id: emailRes.data.id }, to: { id: contact.id }, type: "email_to_contact" }],
              },
              { headers }
            );

            results.push({ email: event.email, contactId: contact.id, engagementId: emailRes.data.id, event: event.event, status: "backfilled" });
          }

          continue;
        }

        // 2b. For delivered/bounce/dropped/unsubscribe — create email engagement
        if (CREATE_EVENTS.has(event.event)) {
          const category = event.category || "Marketing";
          const rawSubject = event.subject || "";
          let emailSubject;
          if (rawSubject && rawSubject !== "Email from Truv" && rawSubject !== "") {
            emailSubject = rawSubject;
          } else {
            emailSubject = `Truv Marketing Email — ${category}`;
          }

          const sentDate = new Date(event.timestamp).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short"
          });
          const statusLabel = event.event === "delivered" ? "Delivered" : event.event === "bounce" ? "Bounced" : event.event === "dropped" ? "Dropped" : "Unsubscribed";

          const rows = [["Status", statusLabel]];
          if (rawSubject && rawSubject !== emailSubject) {
            rows.push(["Subject", rawSubject]);
          }
          rows.push(["Campaign", category], ["Sent", sentDate], ["Channel", "SendGrid"]);

          const emailRes = await axios.post(
            "https://api.hubapi.com/crm/v3/objects/emails",
            {
              properties: {
                hs_timestamp: event.timestamp,
                hs_email_direction: "EMAIL",
                hs_email_status: event.status,
                hs_email_subject: emailSubject,
                hs_email_html: buildEmailHtml(rows, event.sg_message_id),
                hs_email_text: buildEmailText(rows, event.sg_message_id),
                hs_email_headers: JSON.stringify({
                  from: { email: "insights@email.truv.com", firstName: "Truv", lastName: "Marketing" },
                  to: [{ email: event.email, firstName: contact.properties?.firstname || "", lastName: contact.properties?.lastname || "" }],
                }),
              },
            },
            { headers }
          );

          // Associate email to contact
          await axios.post(
            "https://api.hubapi.com/crm/v3/associations/emails/contacts/batch/create",
            {
              inputs: [{ from: { id: emailRes.data.id }, to: { id: contact.id }, type: "email_to_contact" }],
            },
            { headers }
          );

          results.push({ email: event.email, contactId: contact.id, engagementId: emailRes.data.id, event: event.event, status: "logged" });
        }
      } catch (err) {
        results.push({ email: event.email, event: event.event, status: "error", error: err.message });
      }
    }

    const logged = results.filter(r => r.status === "logged").length;
    const updated = results.filter(r => r.status === "updated").length;
    const backfilled = results.filter(r => r.status === "backfilled").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const errors = results.filter(r => r.status === "error").length;

    $.export("$summary", `Logged: ${logged}, Updated: ${updated}, Backfilled: ${backfilled}, Skipped: ${skipped}, Errors: ${errors}`);
    return { summary: `Logged: ${logged}, Updated: ${updated}, Backfilled: ${backfilled}, Skipped: ${skipped}, Errors: ${errors}`, results };
  },
});
1