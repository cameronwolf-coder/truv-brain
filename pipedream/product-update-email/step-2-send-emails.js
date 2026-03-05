// Pipedream Step: send_emails
// Loops HubSpot recipients, merges Notion template data + firstName, sends via SendGrid
// Requires: SendGrid app connected

export default defineComponent({
  props: {
    sendgrid: {
      type: "app",
      app: "sendgrid",
    },
  },
  async run({ steps, $ }) {
    const templateData = steps.parse_notion_page.$return_value.templateData;
    const recipients = steps.get_hubspot_contacts.$return_value.recipients;
    const TEMPLATE_ID = "d-c9d363eaac97470bb73ff78f1782005d";
    const FROM_EMAIL = "updates@truv.com";
    const FROM_NAME = "Truv";

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const contact of recipients) {
      const personalizedData = {
        ...templateData,
        firstName: contact.firstName || "there",
      };

      try {
        await this.sendgrid.makeRequest({
          method: "POST",
          path: "/v3/mail/send",
          data: {
            from: { email: FROM_EMAIL, name: FROM_NAME },
            personalizations: [{
              to: [{ email: contact.email }],
              dynamic_template_data: personalizedData,
            }],
            template_id: TEMPLATE_ID,
          },
        });
        sent++;
      } catch (err) {
        failed++;
        errors.push({ email: contact.email, error: err.message || "Unknown error" });
      }

      // Rate limiting: pause 1s every 50 sends
      if (sent % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      sent,
      failed,
      total: recipients.length,
      errors: errors.slice(0, 10),
      summary: `Sent ${sent}/${recipients.length} emails. ${failed} failed.`,
    };
  },
});
