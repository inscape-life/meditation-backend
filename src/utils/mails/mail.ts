import { Resend } from "resend";
import ForgotPasswordEmail from "./templates/forgot-password-reset";
import { configDotenv } from "dotenv";

configDotenv()
const resend = new Resend(process.env.RESEND_API_KEY)

export const sendPasswordResetEmail = async (email: string, token: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Reset your password",
    react: ForgotPasswordEmail({ otp: token }),
  });
};

export const sendCompanyCreationEmail = async (email: string, companyName: string, password: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Company Added Successfully",
    html: `
      <h3>Welcome to our platform, ${companyName}!</h3>
      <p>Your company has been Added successfully.Thank you for choosing us.</p>
      <p>Below are your login credentials:</p>
      <p>email: ${email}</p>
      <p>password: ${password}</p>
      
    `,
  });
};
// export const sendCompanySignupEmail = async (email: string, companyName: string) => {
//   return await resend.emails.send({
//     from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
//     to: email,
//     subject: "Registration Successful!",
//     html: `
//       <h3>Welcome to our platform, ${companyName}!</h3>
//       <p>Your company has been registered successfully. Thank you for choosing us!</p>
//       <p>If you do not receive an approval email within 48 hours, please contact us.</p>
//       <p>Below are your login credentials:</p>

//       <p>If you need any assistance, feel free to <a href="mailto:support@inscape.life">Contact Us</a>.</p>
//     `,
//   });
// };
export const sendCompanySignupEmail = async (email: string, companyName: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Thank You For Registering",
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; padding: 20px;">
        <h3 style="color: #4CAF50;">Welcome to our platform, ${companyName}!</h3>
        <p>We are excited to have you onboard. Your company has been successfully added, and we appreciate you choosing us!</p>
        

        <p>If you do not receive an approval email within 48 hours, please <a href="mailto:support@inscape.life" style="color: #1E88E5;">contact us</a>.</p>

        <p>Thank you for being part of our platform. We look forward to supporting you!</p>

        <footer style="margin-top: 30px; font-size: 12px; color: #777;">
          <p>If you have any questions, feel free to reach out to us at <a href="mailto:support@inscape.life" style="color: #1E88E5;">support@inscape.life</a>.</p>
        </footer>
      </div>
    `,
  });
};

export const sendAdminCompanySignupEmail = async (companyName: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: process.env.ADMIN_EMAIL as string,
    subject: "New Company Registered",
    html: `
      <h3>New Company Registered</h3>
      <p>A new company has been registered to the platform.</p>
      <p>Company Name: ${companyName}</p>
    `,
  })
}

export const sendUserSignupEmail = async (email: string, firstName: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Welcome to our platform",
    html: `
      <h3>Welcome to our platform, ${firstName} !</h3>
      <p>Your account has been created successfully.Thank you for choosing us.</p>
      
    `,
  });
}

export const sendUserVerificationEmail = async (email: string, verificationCode: string) => {
  try {
 
    return await resend.emails.send({
      from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
      to: email,
      subject: "Verify your email address",
      html: `
        <h3>Verify your email address</h3>
        <p>Please verify your email address by entering the following verification code: ${verificationCode}</p>
        <p>Thank you for signing up!</p>
      `,
    });
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw new Error("Failed to send verification email.");
  }

}
export const sendWelcomeEmail = async (
  email: string,
  clientFirstName: string,
  // platformName: string,
  // supportLink: string
) => {
  try {

    const frontendURL = process.env.FRONTEND_URL || "https://panel.inscape.life";

    return await resend.emails.send({
      from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
      to: email,
      subject: `🎉 Welcome to Inscape – Let’s Build Something Great!`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <p>Welcome aboard!</p>
          <p>We’re thrilled to have you join the Inscape family.</p>
          <p>Our mission is to help you <strong>find inner peace, reduce stress</strong>, and <strong>improve your mindfulness</strong> through guided meditation. You're now part of a community that’s passionate about living a more balanced and fulfilled life.</p>
          <p>Let’s get started!</p>
          <h2>Access your account:</h2>
          <ul>
            <li><a href="${frontendURL}" target="_blank" style="color:rgb(79, 133, 158);">Login here</a> to start your meditation journey.</li>
            <li>Click the “Subscription” link and choose your subscription level. </li>
            <li>The prices you see are “per user/employee”. To sign up more than one user, click the “Activate Plan” for the subscription level you want, and then choose the number of users. Then click the “Continue” button. You will be brought to Stripe where you can pay for your subscription using a major credit card.</li>
            <li>After your subscription is successfully processed by Stripe, you will be returned to your Inscape admin. Now click “Users” and add the users that you want to grant access to. Each user will receive their login details via email.</li>
            </ul>
          <p>If you ever have questions or need a hand, don’t hesitate to reach out. We’re here for you every step of the way.</p>
          <p>Warm regards,</p>
          <p><strong>Dan Globus</strong></p>
          <p>Founder, Inscape</p>
          <p>
          <a href="${frontendURL}" target="_blank" style="color:rgb(79, 133, 158);">https://inscape.life
          </a></p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Failed to send welcome email.");
  }
};

export const subscriptionExpireReminder = async (payload: any) => {
  const expiryDate = new Date(payload.expiryDate); // Convert string to Date object

  // Use toLocaleDateString to format the date
  const formattedExpiryDate = expiryDate.toLocaleDateString('en-US', {
    weekday: 'long', // Full weekday name (e.g., "Sunday")
    year: 'numeric', // Full year (e.g., "2025")
    month: 'long', // Full month name (e.g., "April")
    day: 'numeric', // Day of the month (e.g., "13")
  });

  await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: payload.email,
    subject: "Subscription Expiry Reminder",
    text: `Hello ${payload.name },

We hope you're enjoying our Meditation App.This is a friendly reminder that your subscription is set to expire on ${formattedExpiryDate}.

To continue enjoying uninterrupted access, please renew your subscription before the expiration date.

If you have any questions or need assistance, feel free to contact our support team.

Warm regards,
Dan Globus
Founder, Inscape

`
  });
};

// Renew Now: ${payload.renewalLink}

export const sendUserLoginCredentialsEmail = async (email: string, firstName: string,lastName:string, password: string, companyName: string) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Your Login Credentials",
    html: `
      <h3>Your Login Credentials</h3>
      <p>Hello ${firstName} ${lastName},</p>
      <p>Your account has been successfully created. Please use the following credentials to log in:</p>
      <p><strong>Username:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p>We recommend you change your password after logging in for security purposes.</p>
      <p>If you did not request this, please ignore this email or contact our support team.</p>
      <br>
     <p>Best regards,</p>
      <p>The ${companyName} Team</p>
    `,
  });
}

export const notifyEmailChange = async (
  user: any,
  email: string,
  
) => {
  return await resend.emails.send({
    from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
    to: email,
    subject: "Your Email Address Has Been Updated",
    html: `
      <h3>Email Address Updated</h3>
      <p>Hello ${user.firstName} ${user.lastName},</p>
      <p>Your email address has been successfully updated to <strong>${email}</strong>.</p>
      <p>If you did not request this change, please contact our support team immediately.</p>
      <br>
      <p>Best regards,</p>
      <p>The ${user.companyName || "Your Company Name"}</p> 

    `,
  });
};
export const contactUsMail = async (
  user: any,
  email: string,
) => {
  try {
    const response = await resend.emails.send({
      from: email,
      // to: "mansi@auspicioussoft.com",
      to: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
      subject: "Support Request",
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <p>Dear Support Team,</p>

          <p>You have received a new support inquiry through the contact form. Please find the details below:</p>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold;">Name:</td>
              <td style="padding: 8px;">${user.name || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;">${user.email || email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td>
              <td style="padding: 8px; background-color: #f5f5f5; border-left: 3px solid #007BFF;">
                ${user.reason || "No message provided."}
              </td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Best regards,<br/>Your Website Contact Form</p>

          <hr style="margin: 40px 0; border: none; border-top: 1px solid #ccc;" />

          <footer style="font-size: 12px; color: #777;">
            <p>This message was sent automatically from the contact form on app.</p>
            <p>&copy; ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>
          </footer>
        </div>
      `,
    });
    return response;
  } catch (error) {
    console.error("Error while sending promo code email:", error);
    throw new Error("Failed to send promo code email.");
  }
};
// <p>Please do not reply directly to this email.</p>


  export const sendPromoCodeEmail = async (
    email: string,
    firstName: string,
    promoCode: string,
    // isPercentage:boolean,
    discount?: string, // e.g., "20% off" or "$10 off"
    expirationDate?: string // e.g., "March 31, 2025"
  ) => {
    try {
      const formattedDiscount = discount ? `${discount}%` : ""; 
      const response = await resend.emails.send({

        from: process.env.COMPANY_RESEND_GMAIL_ACCOUNT as string,
        to: email,
        subject: `🎉 Exclusive ${formattedDiscount || "Special"} Offer Inside – Inscape`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #007bff;">🎉 Unlock Your Exclusive Offer</h2>
        <p>Dear ${firstName},</p>
      
        <p>We are pleased to offer you an exclusive promo code ${
          discount ? `for <strong>${discount}%</strong>` : ""
        } on your next purchase.</p>
      
        <div style="background: #f8f9fa; padding: 15px; border-left: 5px solid #007bff; margin: 15px 0;">
          <strong style="font-size: 20px; color: #007bff;">${promoCode}</strong>
        </div>
      
        <p>
          ${
            expirationDate 
          ? `Use this code before <strong>${expirationDate}</strong> to claim your discount.`
          : `Use this code at checkout to enjoy your savings.`
          }
        </p>
              
        <p>Best regards,</p>
        <p><strong>The Inscape Team</strong></p>
          </div>
        `,
      });
  
      return response;
    } catch (error) {
      console.error("Error while sending promo code email:", error);
      throw new Error("Failed to send promo code email.");
    }
  };
  
