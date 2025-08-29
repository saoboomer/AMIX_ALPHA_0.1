import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import handlebars from 'handlebars';
import { AppError } from './error.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create a transporter object using the default SMTP transport
const transporter = createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Verify connection configuration
transporter.verify(function(error, success) {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('Server is ready to take our messages');
  }
});

// Compile email templates
const compileTemplate = async (templateName, context) => {
  try {
    const templatePath = join(__dirname, `../../email-templates/${templateName}.hbs`);
    const template = readFileSync(templatePath, 'utf8');
    return handlebars.compile(template)(context);
  } catch (error) {
    console.error('Error compiling email template:', error);
    throw new AppError('Error preparing email', 500);
  }
};

// Send email function
export const sendEmail = async (options) => {
  try {
    if (!options.template) {
      throw new Error('Email template not specified');
    }

    // Compile the email template
    const html = await compileTemplate(options.template, options.context || {});
    
    // Define email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to: options.email,
      subject: options.subject,
      html,
      text: options.text || html.replace(/<[^>]*>?/gm, ''), // Fallback text version
      attachments: options.attachments || []
    };

    // Send email
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new AppError('There was an error sending the email. Try again later!', 500);
  }
};

// Email templates configuration
const emailTemplates = {
  'welcome': {
    subject: 'Welcome to SecureChat!',
    template: 'welcome-email'
  },
  'password-reset': {
    subject: 'Your password reset token (valid for 10 min)',
    template: 'password-reset'
  },
  'email-verification': {
    subject: 'Verify your email address',
    template: 'email-verification'
  },
  '2fa-enabled': {
    subject: 'Two-Factor Authentication Enabled',
    template: '2fa-enabled'
  },
  'login-alert': {
    subject: 'New login detected',
    template: 'login-alert'
  }
};

// Send a specific type of email
export const sendTemplateEmail = async (type, email, context = {}) => {
  const template = emailTemplates[type];
  
  if (!template) {
    throw new AppError('Invalid email template type', 400);
  }

  await sendEmail({
    email,
    subject: template.subject,
    template: template.template,
    context
  });
};

// Send welcome email
export const sendWelcomeEmail = async (user) => {
  await sendTemplateEmail('welcome', user.email, {
    name: user.username,
    loginUrl: `${process.env.CLIENT_URL}/login`
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
  
  await sendTemplateEmail('password-reset', user.email, {
    name: user.username,
    resetUrl,
    expiresIn: '10 minutes'
  });
};

// Send email verification email
export const sendEmailVerification = async (user, verificationToken) => {
  const verificationUrl = `${process.env.API_URL}/api/v1/auth/verify-email/${verificationToken}`;
  
  await sendTemplateEmail('email-verification', user.email, {
    name: user.username,
    verificationUrl
  });
};

// Send 2FA enabled notification
export const send2FAEnabledEmail = async (user) => {
  await sendTemplateEmail('2fa-enabled', user.email, {
    name: user.username,
    timestamp: new Date().toLocaleString(),
    contactEmail: process.env.SUPPORT_EMAIL || 'support@securechat.com'
  });
};

// Send login alert
export const sendLoginAlert = async (user, deviceInfo) => {
  await sendTemplateEmail('login-alert', user.email, {
    name: user.username,
    timestamp: new Date().toLocaleString(),
    device: deviceInfo.device || 'Unknown device',
    browser: deviceInfo.browser || 'Unknown browser',
    ip: deviceInfo.ip || 'Unknown IP',
    location: deviceInfo.location || 'Unknown location',
    changePasswordUrl: `${process.env.CLIENT_URL}/change-password`,
    contactSupportUrl: `${process.env.CLIENT_URL}/support`
  });
};

export default {
  sendEmail,
  sendTemplateEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  send2FAEnabledEmail,
  sendLoginAlert
};
