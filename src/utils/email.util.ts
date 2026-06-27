import nodemailer from "nodemailer";

type SendEmailInput = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

const host = process.env.SMTP_HOST ?? process.env.MAIL_HOST;
const port = Number(process.env.SMTP_PORT ?? process.env.MAIL_PORT ?? "587");
const user = process.env.SMTP_USER ?? process.env.MAIL_USERNAME;
const pass = process.env.SMTP_PASS ?? process.env.MAIL_PASSWORD;
const fromAddress = process.env.SMTP_FROM ?? process.env.MAIL_FROM_ADDRESS ?? user;
const fromName = process.env.MAIL_FROM_NAME;
const encryption = process.env.MAIL_ENCRYPTION;
const secure = encryption ? encryption.toLowerCase() === "ssl" : port === 465;
const from = fromName && fromAddress ? `"${fromName}" <${fromAddress}>` : fromAddress;

const isConfigured = Boolean(host && user && pass && from);

const transporter = isConfigured
    ? nodemailer.createTransport({
          host,
          port,
          secure,
          auth: {
              user,
              pass,
          },
      })
    : null;

export const sendEmail = async ({ to, subject, text, html }: SendEmailInput) => {
    if (!transporter || !from) {
        // Keep API behavior stable in local/dev when SMTP is not configured.
        console.warn(`SMTP is not configured. Skipping email delivery to ${to}.`);
        return;
    }

    await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
    });
};
