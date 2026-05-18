export interface OutreachTemplate {
  id: string;
  name: string;
  type: "email" | "dm";
  subject?: string;
  body: string;
}

export function getTemplates(
  appName: string,
  developerName: string
): OutreachTemplate[] {
  return [
    {
      id: "email-1",
      name: "First Contact",
      type: "email",
      subject: `Quick question about ${appName}`,
      body: `Hi ${developerName},

I came across ${appName} on the App Store and I'm impressed by what you built — especially the number of users and reviews it has gathered.

I run a portfolio of iOS apps and I'm always looking to acquire apps that have great foundations. I noticed ${appName} hasn't been updated recently, and I wanted to ask:

Would you be open to selling ${appName}? I'd offer $2,000–$3,000 for the full transfer (source code, App Store Connect access, and assets).

No pressure at all — just wanted to float the idea. Either way, cool app.

Best,
[Your Name]`,
    },
    {
      id: "email-2",
      name: "Follow-Up",
      type: "email",
      subject: `Re: Quick question about ${appName}`,
      body: `Hi ${developerName},

Just bumping this to the top of your inbox. I know you're busy — totally understand if it's not something you're interested in.

If you ARE open to it, I can make the process very smooth:
- Funds via PayPal/Wise within 24 hours of agreement
- I handle all App Store Connect transfer paperwork
- Simple asset purchase agreement (I'll draft it)

Let me know either way!

[Your Name]`,
    },
    {
      id: "dm-1",
      name: "Social DM",
      type: "dm",
      body: `Hey ${developerName}! Love what you built with ${appName}. I acquire and maintain iOS apps and I'm interested in buying it from you for $2-3K. Would you be open to a quick chat? No pressure either way.`,
    },
  ];
}

export function getFullEmail(template: OutreachTemplate): string {
  if (template.subject) {
    return `Subject: ${template.subject}\n\n${template.body}`;
  }
  return template.body;
}
